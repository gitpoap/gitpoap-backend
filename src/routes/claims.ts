import {
  ClaimGitPOAPSchema,
  CreateGitPOAPClaimsSchema,
  CreateGitPOAPBotClaimsSchema,
} from '../schemas/claims';
import { Router, Request } from 'express';
import { context } from '../context';
import { ClaimStatus, GitPOAP, GitPOAPStatus, GitPOAPType } from '@prisma/client';
import {
  gitpoapBotAuth,
  jwtWithAddress,
  jwtWithAdminOAuth,
  jwtWithGitHubOAuth,
} from '../middleware';
import { getAccessTokenPayloadWithOAuth } from '../types/authTokens';
import { redeemPOAP, retrieveClaimInfo } from '../external/poap';
import { getGithubUserById } from '../external/github';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import { sleep } from '../lib/sleep';
import { backloadGithubPullRequestData } from '../lib/pullRequests';
import { upsertUser } from '../lib/users';
import {
  ClaimData,
  retrieveClaimsCreatedByMention,
  retrieveClaimsCreatedByPR,
  updateClaimStatusById,
} from '../lib/claims';
import { checkIfClaimTransferred } from '../lib/transfers';
import { z } from 'zod';
import { BotCreateClaimsErrorType, createClaimsForPR, createClaimsForIssue } from '../lib/bot';
import { RestrictedContribution } from '../lib/contributions';
import { sendInternalClaimMessage } from '../external/slack';
import { isAddressAnAdmin } from '../lib/admins';
import { getAccessTokenPayload } from '../types/authTokens';
import { ensureRedeemCodeThreshold } from '../lib/claims';

export const claimsRouter = Router();

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

claimsRouter.post('/', jwtWithGitHubOAuth(), async function (req, res) {
  const logger = createScopedLogger('POST /claims');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('POST', '/claims');

  const schemaResult = ClaimGitPOAPSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { addressId, address, githubId, githubHandle } = getAccessTokenPayloadWithOAuth(req.user);

  logger.info(`Request claiming IDs ${req.body.claimIds} for address ${address}`);

  const foundClaims: number[] = [];
  const qrHashes: string[] = [];
  const invalidClaims: { claimId: number; reason: string }[] = [];

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
        claimId,
        reason: "Claim ID doesn't exist",
      });
      continue;
    }

    if (!claim.gitPOAP.isEnabled) {
      logger.warn(`GitHub user ${githubHandle} attempted to claim a non-enabled GitPOAP`);
      invalidClaims.push({
        claimId,
        reason: `GitPOAP ID ${claim.gitPOAP.id} is not enabled`,
      });
      continue;
    }

    // Check to ensure the claim has not already been processed
    if (claim.status !== ClaimStatus.UNCLAIMED) {
      invalidClaims.push({
        claimId,
        reason: `Claim has status '${claim.status}'`,
      });
      continue;
    }

    // Ensure the user is the owner of the claim
    if (claim.user?.githubId !== githubId) {
      invalidClaims.push({
        claimId,
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
      invalidClaims.push({ claimId, reason: msg });
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

    await updateClaimStatusById(claimId, ClaimStatus.PENDING, addressId);

    const poapData = await redeemPOAP(address, redeemCode.code);
    // If minting the POAP failed we need to revert
    if (poapData === null) {
      logger.error(`Failed to mint claim ${claimId} via the POAP API`);

      invalidClaims.push({
        claimId,
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
      await updateClaimStatusById(claimId, ClaimStatus.UNCLAIMED, null);

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

    // Ensure that we have the minimal number of codes if the GitPOAP
    // is marked as ongoing. Note that we don't need to block on this
    // since we don't depend on its result
    void ensureRedeemCodeThreshold(claim.gitPOAP);
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

  void sendInternalClaimMessage(foundClaims, githubHandle, address);

  logger.debug(`Completed request claiming IDs ${req.body.claimIds} for address ${address}`);

  endTimer({ status: 200 });

  res.status(200).send({
    claimed: foundClaims,
    invalid: [],
  });

  await runClaimsPostProcessing(foundClaims, qrHashes);
});

claimsRouter.post('/create', jwtWithAdminOAuth(), async function (req, res) {
  const logger = createScopedLogger('POST /claims/create');
  const endTimer = httpRequestDurationSeconds.startTimer('POST', '/claims/create');

  logger.error('[DEPRECATED] POST /claims/create called');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const schemaResult = CreateGitPOAPClaimsSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { githubOAuthToken } = getAccessTokenPayloadWithOAuth(req.user);

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
  if (gitPOAPData.poapApprovalStatus === GitPOAPStatus.UNAPPROVED) {
    const msg = `GitPOAP ID ${req.body.gitPOAPId} has not been approved yet`;
    logger.warn(msg);
    endTimer({ status: 400 });
    return res.status(400).send({ msg });
  }
  if (gitPOAPData.poapApprovalStatus === GitPOAPStatus.DEPRECATED) {
    const msg = `GitPOAP ID ${req.body.gitPOAPId} is deprecated`;
    logger.warn(msg);
    endTimer({ status: 400 });
    return res.status(400).send({ msg });
  }

  const notFound = [];
  for (const githubId of req.body.recipientGithubIds) {
    const githubUserInfo = await getGithubUserById(githubId, githubOAuthToken);
    if (githubUserInfo === null) {
      logger.warn(`GitHub ID ${githubId} not found!`);
      notFound.push(githubId);
      continue;
    }

    if (githubUserInfo.type === 'Bot') {
      logger.info(`Skipping creating claims for bot ${githubUserInfo.login}`);
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
  if (gitPOAPData.project !== null) {
    const repos = gitPOAPData.project.repos;
    for (const repo of repos) {
      void backloadGithubPullRequestData(repo.id);
    }
  }
});

claimsRouter.post(
  '/gitpoap-bot/create',
  gitpoapBotAuth(),
  async function (req: Request<any, any, z.infer<typeof CreateGitPOAPBotClaimsSchema>>, res) {
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

    let wasEarnedByMention: boolean;

    let newClaims: ClaimData[] = [];
    if ('pullRequest' in schemaResult.data) {
      const { organization, repo, pullRequestNumber, contributorGithubIds, wasEarnedByMention } =
        schemaResult.data.pullRequest;

      let mentionInfo = ' mentions in';
      if (!wasEarnedByMention) {
        mentionInfo = '';

        // If a PR was just merged, we assume there was only one author
        if (contributorGithubIds.length > 1) {
          const msg = `Bot called on merged PR with more than one contributor specified`;
          logger.error(msg);
          endTimer({ status: 400 });
          return res.status(400).send({ msg });
        }
      }

      logger.info(
        `Request to create claim for${mentionInfo} PR #${pullRequestNumber} on "${organization}/${repo}"`,
      );

      const contributions: RestrictedContribution[] = [];
      for (const githubId of contributorGithubIds) {
        const newContribution = await createClaimsForPR(
          organization,
          repo,
          pullRequestNumber,
          githubId,
          wasEarnedByMention,
        );
        if (newContribution === BotCreateClaimsErrorType.RepoNotFound) {
          return res
            .status(404)
            .send({ msg: `Failed to find repo with name "${organization}/${repo}"` });
        } else if (newContribution === BotCreateClaimsErrorType.GithubRecordNotFound) {
          return res.status(404).send({ msg: 'Failed to find repo on GitHub' });
        } else if (newContribution !== BotCreateClaimsErrorType.BotUser) {
          contributions.push(newContribution);
        }
      }

      const githubIdSet = new Set<number>(contributorGithubIds);
      for (const contribution of contributions) {
        if (contribution === null) {
          continue;
        } else if ('pullRequest' in contribution) {
          const newClaimsForContribution = await retrieveClaimsCreatedByPR(
            contribution.pullRequest.id,
          );
          newClaims = [...newClaims, ...newClaimsForContribution];
        } else {
          // 'mention' in contribution
          const newClaimsForContribution = await retrieveClaimsCreatedByMention(
            contribution.mention.id,
          );

          const filteredNewClaims = newClaimsForContribution.filter(
            claimData => claimData.user && githubIdSet.has(claimData.user.githubId),
          );

          newClaims = [...newClaims, ...filteredNewClaims];
        }
      }

      logger.debug(
        `Completed request to create claim for${mentionInfo} PR #${pullRequestNumber} on "${organization}/${repo}`,
      );
    } else {
      // 'issue' in req.body
      const { organization, repo, issueNumber, contributorGithubIds, wasEarnedByMention } =
        schemaResult.data.issue;

      if (wasEarnedByMention === false) {
        logger.error(
          `gitpoap-bot tried to create a claim for issue #${issueNumber} without a mention in "${organization}/${repo}"`,
        );
        return res
          .status(400)
          .send({ msg: 'Cannot create a claim for an issue without a mention' });
      }

      logger.info(
        `Request to create claim for mention in Issue #${issueNumber} on "${organization}/${repo}"`,
      );

      const contributions: RestrictedContribution[] = [];
      for (const githubId of contributorGithubIds) {
        const newContribution = await createClaimsForIssue(
          organization,
          repo,
          issueNumber,
          githubId,
        );
        if (newContribution === BotCreateClaimsErrorType.RepoNotFound) {
          return res
            .status(404)
            .send({ msg: `Failed to find repo with name "${organization}/${repo}"` });
        } else if (newContribution === BotCreateClaimsErrorType.GithubRecordNotFound) {
          return res.status(404).send({ msg: 'Failed to find repo on GitHub' });
        } else if (newContribution !== BotCreateClaimsErrorType.BotUser) {
          contributions.push(newContribution);
        }
      }

      const githubIdSet = new Set<number>(contributorGithubIds);
      for (const contribution of contributions) {
        if (contribution === null) {
          continue;
        } else if ('mention' in contribution) {
          const newClaimsForContribution = await retrieveClaimsCreatedByMention(
            contribution.mention.id,
          );

          const filteredNewClaims = newClaimsForContribution.filter(
            claimData => claimData.user && githubIdSet.has(claimData.user.githubId),
          );

          newClaims = [...newClaims, ...filteredNewClaims];
        } else {
          // 'pullRequest' in contribution
          logger.error('Got back a pull request from createClaimsForIssue');
          return res.status(500).send({ msg: 'createClaimsForIssue failed' });
        }
      }

      logger.debug(
        `Completed request to create claim for mention in Issue #${issueNumber} on "${organization}/${repo}"`,
      );
    }

    endTimer({ status: 200 });

    res.status(200).send({ newClaims });
  },
);

claimsRouter.post('/revalidate', jwtWithGitHubOAuth(), async (req, res) => {
  const logger = createScopedLogger('POST /claims/revalidate');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('POST', '/claims/revalidate');

  // We have the same body requirements here as in the claim endpoint
  const schemaResult = ClaimGitPOAPSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { address, githubId, githubHandle } = getAccessTokenPayloadWithOAuth(req.user);

  logger.info(
    `Request to revalidate GitPOAP IDs ${req.body.claimIds} by GitHub user ${githubHandle}`,
  );

  const foundClaims: number[] = [];
  const invalidClaims: { claimId: number; reason: string }[] = [];

  for (const claimId of req.body.claimIds) {
    const claim = await context.prisma.claim.findUnique({
      where: {
        id: claimId,
      },
      select: {
        status: true,
        mintedAddress: true,
        user: {
          select: {
            githubId: true,
          },
        },
      },
    });

    if (!claim) {
      invalidClaims.push({
        claimId,
        reason: "Claim ID doesn't exist",
      });
      continue;
    }

    // If the claim address is not set to the user sending the request,
    // assume the user is correct and that perhaps we haven't seen the
    // transfer yet in our backend
    if (claim.mintedAddress?.ethAddress !== address) {
      const newAddress = await checkIfClaimTransferred(claimId);

      if (newAddress?.toLowerCase() !== address) {
        invalidClaims.push({
          claimId,
          reason: 'Logged-in Address is not the current owner',
        });
        continue;
      }
    }

    if (claim.user?.githubId !== githubId) {
      invalidClaims.push({
        claimId,
        reason: 'User does not own claim',
      });
    }

    await context.prisma.claim.update({
      where: {
        id: claimId,
      },
      data: {
        needsRevalidation: false,
      },
    });
  }

  if (invalidClaims.length > 0) {
    logger.warn(`Some claim re-validations were invalid: ${JSON.stringify(invalidClaims)}`);

    // Return 400 iff no claim re-validations were completed
    if (foundClaims.length === 0) {
      return res.status(400).send({
        claimed: foundClaims,
        invalid: invalidClaims,
      });
    }
  }

  logger.debug(
    `Completed request to revalidate GitPOAP IDs ${req.body.claimIds} by GitHub user ${githubHandle}`,
  );

  endTimer({ status: 200 });

  res.status(200).send({
    claimed: foundClaims,
    invalid: [],
  });
});

claimsRouter.delete('/:id', jwtWithAddress(), async (req, res) => {
  const logger = createScopedLogger('DELETE /claims/:id');
  const endTimer = httpRequestDurationSeconds.startTimer('DELETE', '/claims/:id');

  const claimId = parseInt(req.params.id, 10);

  logger.info(`Request to delete Claim with ID: ${claimId}`);

  const claim = await context.prisma.claim.findUnique({
    where: { id: claimId },
    select: {
      status: true,
      gitPOAP: {
        select: {
          id: true,
          type: true,
          creatorAddressId: true,
        },
      },
    },
  });

  // If the claim has already been deleted
  if (claim === null) {
    logger.info(`Completed request to delete Claim with ID: ${claimId}`);
    endTimer({ status: 200 });
    return res.status(200).send('DELETED');
  }

  const { addressId, address } = getAccessTokenPayload(req.user);

  if (claim.gitPOAP.type === GitPOAPType.CUSTOM) {
    // If the GitPOAP is CUSTOM ensure that requestor is it's creator
    if (claim.gitPOAP.creatorAddressId === null) {
      logger.error(
        `Custom GitPOAP ID ${claim.gitPOAP.id} does not have an associated creatorAddress`,
      );
      endTimer({ status: 500 });
      return res.status(500).send({ msg: "Can't authenticate GitPOAP ownership" });
    }

    if (claim.gitPOAP.creatorAddressId !== addressId) {
      logger.warn(
        `User attempted to delete a Claim for a custom GitPOAP (ID: ${claim.gitPOAP.id} that they do not own`,
      );
      endTimer({ status: 401 });
      return res.status(401).send({ msg: 'Not Custom GitPOAP creator' });
    }
  } else {
    // Otherwise ensure that the requestor is an admin
    if (!isAddressAnAdmin(address)) {
      logger.warn(`Non-admin address ${address} attempted to delete a Claim for a GitPOAP`);
      endTimer({ status: 401 });
      return res.status(401).send({ msg: 'Not authorized to delete claims' });
    }
  }

  if (claim.status !== ClaimStatus.UNCLAIMED) {
    logger.warn(`User attempted to delete a Claim (ID: ${claimId}) that has already been claimed`);
    endTimer({ status: 400 });
    return res.status(400).send({ msg: 'Already claimed' });
  }

  // Use deleteMany so we don't fail if another request deletes the record during this request
  await context.prisma.claim.deleteMany({
    where: { id: claimId },
  });

  logger.debug(`Completed request to delete Claim with ID: ${claimId}`);

  endTimer({ status: 200 });

  return res.status(200).send('DELETED');
});
