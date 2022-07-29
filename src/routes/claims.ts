import {
  ClaimGitPOAPSchema,
  CreateGitPOAPBotClaimsSchema,
  CreateGitPOAPClaimsSchema,
} from '../schemas/claims';
import { Router, Request } from 'express';
import { context } from '../context';
import { ClaimStatus, GitPOAP, GitPOAPStatus } from '@prisma/client';
import { resolveENS } from '../external/ens';
import { isSignatureValid } from '../signatures';
import jwt from 'express-jwt';
import { jwtWithAdminOAuth, gitpoapBotAuth } from '../middleware';
import { AccessTokenPayload, AccessTokenPayloadWithOAuth } from '../types/tokens';
import { redeemPOAP, requestPOAPCodes, retrieveClaimInfo } from '../external/poap';
import { getSingleGithubRepositoryPullAsAdmin, getGithubUserById } from '../external/github';
import { JWT_SECRET } from '../environment';
import { createScopedLogger } from '../logging';
import { MINIMUM_REMAINING_REDEEM_CODES, REDEEM_CODE_STEP_SIZE } from '../constants';
import { httpRequestDurationSeconds } from '../metrics';
import { DateTime } from 'luxon';
import { sleep } from '../lib/sleep';
import {
  backloadGithubPullRequestData,
  upsertGithubPullRequest,
  extractMergeCommitSha,
} from '../lib/pullRequests';
import { upsertUser } from '../lib/users';
import { createNewClaimsForRepoPR, RepoData, retrieveClaimsCreatedByPR } from '../lib/claims';
import { getRepoByName } from '../lib/repos';

export const claimsRouter = Router();

// Ensure that we still have enough codes left for a GitPOAP after a claim
async function ensureRedeemCodeThreshold(gitPOAP: GitPOAP) {
  // If the distribution is not ongoing then we don't need to do anything
  if (!gitPOAP.ongoing) {
    return;
  }

  const logger = createScopedLogger('ensureRedeemCodeThreshold');

  if (gitPOAP.status === GitPOAPStatus.REDEEM_REQUEST_PENDING) {
    logger.info(`Redeem request is already pending for GitPOAP ID: ${gitPOAP.id}`);
    return;
  }

  const codeCount = await context.prisma.redeemCode.count({
    where: {
      gitPOAPId: gitPOAP.id,
    },
  });

  logger.debug(`GitPOAP ID ${gitPOAP.id} has ${codeCount} remaining redeem codes`);

  if (codeCount < MINIMUM_REMAINING_REDEEM_CODES) {
    await context.prisma.gitPOAP.update({
      where: {
        id: gitPOAP.id,
      },
      data: {
        status: GitPOAPStatus.REDEEM_REQUEST_PENDING,
      },
    });

    logger.info(`Requesting additional codes for GitPOAP ID: ${gitPOAP.id}`);

    // Note that this function does not return any codes.
    // Instead we need to wait for them with our background process for checking
    // for new codes, so while waiting we have marked the GitPOAP's status
    // as REDEEM_REQUEST_PENDING
    const poapResponse = await requestPOAPCodes(
      gitPOAP.poapEventId,
      gitPOAP.poapSecret,
      REDEEM_CODE_STEP_SIZE,
    );
    if (poapResponse === null) {
      // In this case, the request to POAP has failed for some reason, so we
      // move the GitPOAP's state back into ACCEPTED so that it will attempt
      // to make another request after the next claim (it will see we are
      // below the threshold again
      await context.prisma.gitPOAP.update({
        where: {
          id: gitPOAP.id,
        },
        data: {
          status: GitPOAPStatus.REDEEM_REQUEST_PENDING,
        },
      });

      const msg = `Failed to request additional redeem codes for GitPOAP ID: ${gitPOAP.id}`;
      logger.error(msg);
      return;
    }
  }
}

async function runClaimsPostProcessing(claimIds: number[], qrHashes: string[]) {
  const logger = createScopedLogger('runClaimsPostProcessing');

  while (claimIds.length > 0) {
    logger.info(`Waiting for ${claimIds.length} claim transactions to process`);

    // Wait for 5 seconds
    await sleep(5);

    // Helper function to remove a claim from postprocessing
    const removeAtIndex = (i: number) => {
      claimIds.splice(i, 1);
      qrHashes.splice(i, 1);
    };

    for (let i = 0; i < claimIds.length; ++i) {
      const poapData = await retrieveClaimInfo(qrHashes[i]);
      if (poapData === null) {
        logger.error(`Failed to retrieve claim info for Claim ID: ${claimIds[i]}`);
        removeAtIndex(i);
        break;
      }

      if (poapData.tx_status === 'passed') {
        if (!('token' in poapData.result)) {
          logger.error("No 'token' field in POAP response for Claim after tx_status='passed'");
          removeAtIndex(i);
          break;
        }

        // Set the new poapTokenId now that the TX is finalized
        await context.prisma.claim.update({
          where: {
            id: claimIds[i],
          },
          data: {
            status: ClaimStatus.CLAIMED,
            poapTokenId: poapData.result.token.toString(),
            mintedAt: new Date(),
          },
        });

        removeAtIndex(i);
      }
    }
  }

  logger.info('Finished claims post processing');
}

claimsRouter.post(
  '/',
  jwt({ secret: JWT_SECRET as string, algorithms: ['HS256'] }),
  async function (req, res) {
    const logger = createScopedLogger('POST /claims');

    logger.debug(`Body: ${JSON.stringify(req.body)}`);

    const endTimer = httpRequestDurationSeconds.startTimer('POST', '/claims');

    if (!req.user) {
      logger.warn('No access token provided');
      endTimer({ status: 401 });
      return res.status(401).send({ message: 'Invalid or missing Access Token' });
    }

    const schemaResult = ClaimGitPOAPSchema.safeParse(req.body);
    if (!schemaResult.success) {
      logger.warn(
        `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
      );
      endTimer({ status: 400 });
      return res.status(400).send({ issues: schemaResult.error.issues });
    }

    logger.info(`Request claiming IDs ${req.body.claimIds} for address ${req.body.address}`);

    // Resolve ENS if provided
    const resolvedAddress = await resolveENS(req.body.address);
    if (resolvedAddress === null) {
      logger.warn('Request address is invalid');
      endTimer({ status: 400 });
      return res.status(400).send({ msg: `${req.body.address} is not a valid address` });
    }

    if (
      !isSignatureValid(resolvedAddress, 'POST /claims', req.body.signature, {
        claimIds: req.body.claimIds,
      })
    ) {
      logger.warn('Request signature is invalid');
      endTimer({ status: 401 });
      return res.status(401).send({ msg: 'The signature is not valid for this address and data' });
    }

    let foundClaims: number[] = [];
    let qrHashes: string[] = [];
    let invalidClaims: { claimId: number; reason: string }[] = [];

    for (const claimId of req.body.claimIds) {
      const claim = await context.prisma.claim.findUnique({
        where: {
          id: claimId,
        },
        include: {
          user: true,
          gitPOAP: true,
        },
      });

      if (!claim) {
        invalidClaims.push({
          claimId: claimId,
          reason: "Claim ID doesn't exist",
        });
        continue;
      }

      // Check to ensure the claim has not already been processed
      if (claim.status !== ClaimStatus.UNCLAIMED) {
        invalidClaims.push({
          claimId: claimId,
          reason: `Claim has status '${claim.status}'`,
        });
        continue;
      }

      // Ensure the user is the owner of the claim
      if (claim.user.githubId !== (<AccessTokenPayload>req.user).githubId) {
        invalidClaims.push({
          claimId: claimId,
          reason: 'User does not own claim',
        });
        continue;
      }

      const redeemCode = await context.prisma.redeemCode.findFirst({
        where: {
          gitPOAPId: claim.gitPOAP.id,
        },
      });
      if (redeemCode === null) {
        const msg = `GitPOAP ID ${claim.gitPOAP.id} has no more redeem codes`;
        logger.error(msg);
        invalidClaims.push({ claimId: claimId, reason: msg });
        continue;
      }
      try {
        await context.prisma.redeemCode.delete({
          where: {
            id: redeemCode.id,
          },
        });
      } catch (err) {
        logger.error(`Tried to delete a RedeemCode that was already deleted: ${err}`);
      }

      // Mark that we are processing the claim
      await context.prisma.claim.update({
        where: {
          id: claimId,
        },
        data: {
          status: ClaimStatus.PENDING,
          address: resolvedAddress.toLowerCase(),
        },
      });

      const poapData = await redeemPOAP(req.body.address, redeemCode.code);
      // If minting the POAP failed we need to revert
      if (poapData === null) {
        logger.error(`Failed to mint claim ${claimId} via the POAP API`);

        invalidClaims.push({
          claimId: claimId,
          reason: 'Failed to claim via POAP API',
        });

        await context.prisma.redeemCode.create({
          data: {
            gitPOAP: {
              connect: {
                id: claim.gitPOAP.id,
              },
            },
            code: redeemCode.code,
          },
        });
        await context.prisma.claim.update({
          where: {
            id: claimId,
          },
          data: {
            status: ClaimStatus.UNCLAIMED,
            address: null,
          },
        });

        continue;
      }
      foundClaims.push(claimId);
      qrHashes.push(poapData.qr_hash);

      // Mark that the POAP has been claimed
      await context.prisma.claim.update({
        where: {
          id: claimId,
        },
        data: {
          status: ClaimStatus.MINTING,
          qrHash: poapData.qr_hash,
        },
      });

      // Ensure that a profile exists for the address
      await context.prisma.profile.upsert({
        where: {
          address: resolvedAddress.toLowerCase(),
        },
        update: {},
        create: {
          address: resolvedAddress.toLowerCase(),
        },
      });

      // Ensure that we have the minimal number of codes if the GitPOAP
      // is marked as ongoing. Note that we don't need to block on this
      // since we don't depend on its result
      ensureRedeemCodeThreshold(claim.gitPOAP);
    }

    if (invalidClaims.length > 0) {
      logger.warn(`Some claims were invalid: ${JSON.stringify(invalidClaims)}`);

      // Return 400 iff no claims were completed
      if (foundClaims.length === 0) {
        return res.status(400).send({
          claimed: foundClaims,
          invalid: invalidClaims,
        });
      }
    }

    logger.debug(
      `Completed request claiming IDs ${req.body.claimIds} for address ${req.body.address}`,
    );

    endTimer({ status: 200 });

    res.status(200).send({
      claimed: foundClaims,
      invalid: [],
    });

    await runClaimsPostProcessing(foundClaims, qrHashes);
  },
);

claimsRouter.post('/create', jwtWithAdminOAuth(), async function (req, res) {
  const logger = createScopedLogger('POST /claims/create');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('POST', '/claims/create');

  const schemaResult = CreateGitPOAPClaimsSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info(
    `Request to create ${req.body.recipientGithubIds.length} claims for GitPOAP Id: ${req.body.gitPOAPId}`,
  );

  const gitPOAPData = await context.prisma.gitPOAP.findUnique({
    where: {
      id: req.body.gitPOAPId,
    },
    include: {
      project: {
        select: {
          repos: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });
  if (gitPOAPData === null) {
    logger.warn(`GitPOAP ID ${req.body.gitPOAPId} not found`);
    endTimer({ status: 404 });
    return res.status(404).send({ msg: `There is not GitPOAP with ID: ${req.body.gitPOAPId}` });
  }
  if (gitPOAPData.status === GitPOAPStatus.UNAPPROVED) {
    const msg = `GitPOAP ID ${req.body.gitPOAPId} has not been approved yet`;
    logger.warn(msg);
    endTimer({ status: 400 });
    return res.status(400).send({ msg });
  }

  let notFound = [];
  for (const githubId of req.body.recipientGithubIds) {
    const githubUserInfo = await getGithubUserById(
      githubId,
      (<AccessTokenPayloadWithOAuth>req.user).githubOAuthToken,
    );
    if (githubUserInfo === null) {
      logger.warn(`GitHub ID ${githubId} not found!`);
      notFound.push(githubId);
      continue;
    }

    // Ensure that we've created a user in our
    // system for the claim
    const user = await upsertUser(githubId, githubUserInfo.login);

    // Upsert so we can rerun the script if necessary
    await context.prisma.claim.upsert({
      where: {
        gitPOAPId_userId: {
          gitPOAPId: gitPOAPData.id,
          userId: user.id,
        },
      },
      update: {},
      create: {
        gitPOAP: {
          connect: {
            id: gitPOAPData.id,
          },
        },
        user: {
          connect: {
            id: user.id,
          },
        },
      },
    });
  }

  if (notFound.length > 0) {
    endTimer({ status: 400 });
    return res.status(400).send({
      msg: 'Some of the githubIds were not found',
      ids: notFound,
    });
  }

  logger.debug(
    `Completed request to create ${req.body.recipientGithubIds.length} claims for GitPOAP Id: ${req.body.gitPOAPId}`,
  );

  endTimer({ status: 200 });

  res.status(200).send('CREATED');

  // Run the backloader in the background
  for (const repo of gitPOAPData.project.repos) {
    backloadGithubPullRequestData(repo.id);
  }
});

type ReqBody = { repo: string; owner: string; pullRequestNumber: number };

claimsRouter.post(
  '/gitpoap-bot/create',
  gitpoapBotAuth(),
  async function (req: Request<any, any, ReqBody>, res) {
    const logger = createScopedLogger('POST /claims/gitpoap-bot/create');

    logger.debug(`Body: ${JSON.stringify(req.body)}`);

    const endTimer = httpRequestDurationSeconds.startTimer('POST', '/claims/gitpoap-bot/create');

    const schemaResult = CreateGitPOAPBotClaimsSchema.safeParse(req.body);
    if (!schemaResult.success) {
      logger.warn(
        `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
      );
      endTimer({ status: 400 });
      return res.status(400).send({ issues: schemaResult.error.issues });
    }

    logger.info(
      `Request to create claim for PR #${req.body.pullRequestNumber} on "${req.body.owner}/${req.body.repo}"`,
    );

    const repo = await getRepoByName(req.body.owner, req.body.repo);
    if (repo === null) {
      const msg = `Failed to find repo: "${req.body.owner}/${req.body.repo}"`;
      logger.warn(msg);
      endTimer({ status: 404 });
      return res.status(404).send({ msg });
    }

    const pull = await getSingleGithubRepositoryPullAsAdmin(
      req.body.owner,
      req.body.repo,
      req.body.pullRequestNumber,
    );
    if (pull === null) {
      const msg = `Failed to query repo data for "${req.body.owner}/${req.body.repo}" via GitHub API`;
      logger.error(msg);
      endTimer({ status: 404 });
      return res.status(404).send({ msg });
    }

    // Ensure that we've created a user in our system for the claim
    const user = await upsertUser(pull.user.id, pull.user.login);

    const githubPullRequest = await upsertGithubPullRequest(
      repo.id,
      pull.number,
      pull.title,
      // Since we are getting from the merge message, we assume this is not null
      new Date(<string>pull.merged_at),
      extractMergeCommitSha(pull),
      user.id,
    );

    // Create any new claims (if they haven't been already)
    await createNewClaimsForRepoPR(user, repo, githubPullRequest);

    const newClaims = await retrieveClaimsCreatedByPR(githubPullRequest.id);

    logger.debug(
      `Completed request to create claim for PR #${req.body.pullRequestNumber} on "${req.body.owner}/${req.body.repo}`,
    );

    endTimer({ status: 200 });

    res.status(200).send({ newClaims });
  },
);
