import {
  ClaimGitPOAPSchema,
  CreateGitPOAPClaimsSchema,
  CreateGitPOAPBotClaimsSchema,
} from '../schemas/claims';
import { Router, Request } from 'express';
import { context } from '../context';
import { ClaimStatus, GitPOAPStatus, GitPOAPType } from '@prisma/client';
import { gitpoapBotAuth, jwtWithAddress, jwtWithAdminOAuth } from '../middleware/auth';
import { getAccessTokenPayloadWithGithubOAuth } from '../types/authTokens';
import { redeemPOAP } from '../external/poap';
import { getGithubUserById } from '../external/github';
import { backloadGithubPullRequestData } from '../lib/pullRequests';
import { upsertGithubUser } from '../lib/githubUsers';
import {
  retrieveClaimsCreatedByMention,
  retrieveClaimsCreatedByPR,
  updateClaimStatusById,
} from '../lib/claims';
import { checkIfClaimTransferred } from '../lib/transfers';
import { z } from 'zod';
import { BotCreateClaimsErrorType, createClaimsForPR, createClaimsForIssue } from '../lib/bot';
import { RestrictedContribution } from '../lib/contributions';
import { sendInternalClaimMessage, sendInternalClaimByMentionMessage } from '../external/slack';
import { isAddressAnAdmin } from '../lib/admins';
import { getAccessTokenPayload } from '../types/authTokens';
import { ensureRedeemCodeThreshold, runClaimsPostProcessing } from '../lib/claims';
import { ClaimData, FoundClaim } from '../types/claims';
import { getRequestLogger } from '../middleware/loggingAndTiming';
import { shortenAddress } from '../lib/addresses';
import { chooseUnusedRedeemCode, deleteRedeemCode, upsertRedeemCode } from '../lib/codes';

export const claimsRouter = Router();

claimsRouter.post('/', jwtWithAddress(), async function (req, res) {
  const logger = getRequestLogger(req);

  const schemaResult = ClaimGitPOAPSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const {
    addressId,
    address: ethAddress,
    ensName,
    emailId,
    githubId,
  } = getAccessTokenPayload(req.user);
  const { claimIds } = schemaResult.data;

  logger.info(`Request claiming IDs ${claimIds} for address ${ethAddress}`);

  const foundClaims: FoundClaim[] = [];
  const qrHashes: string[] = [];
  const invalidClaims: { claimId: number; reason: string }[] = [];

  for (const claimId of claimIds) {
    const claim = await context.prisma.claim.findUnique({
      where: {
        id: claimId,
      },
      include: {
        githubUser: {
          select: {
            githubId: true,
            githubHandle: true,
          },
        },
        gitPOAP: true,
      },
    });

    if (!claim) {
      invalidClaims.push({
        claimId,
        reason: `Claim doesn't exist`,
      });
      continue;
    }

    if (!claim.gitPOAP.isEnabled) {
      logger.warn(
        `User with address: ${shortenAddress(
          ethAddress,
        )} (ID: ${addressId}) attempted to claim a non-enabled GitPOAP`,
      );
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

    // Check that the user owns the claim
    if (
      claim.githubUser?.githubId !== githubId &&
      claim.issuedAddressId !== addressId &&
      claim.emailId !== emailId
    ) {
      invalidClaims.push({
        claimId,
        reason: "User doesn't own Claim",
      });
      continue;
    }

    const redeemCode = await chooseUnusedRedeemCode(claim.gitPOAP);
    if (redeemCode === null) {
      const msg = `GitPOAP ID ${claim.gitPOAP.id} has no more redeem codes`;
      logger.error(msg);
      invalidClaims.push({ claimId, reason: msg });
      continue;
    }

    await deleteRedeemCode(redeemCode.id);
    await updateClaimStatusById(claimId, ClaimStatus.PENDING, addressId);

    const poapData = await redeemPOAP(ethAddress, redeemCode.code);
    // If minting the POAP failed we need to revert
    if (poapData === null) {
      logger.error(`Failed to mint claim ${claimId} via the POAP API`);

      invalidClaims.push({
        claimId,
        reason: 'Failed to claim via POAP API',
      });

      await upsertRedeemCode(claim.gitPOAP.id, redeemCode.code);
      await updateClaimStatusById(claimId, ClaimStatus.UNCLAIMED, null);

      continue;
    }
    foundClaims.push({
      claimId,
      gitPOAPId: claim.gitPOAP.id,
      gitPOAPName: claim.gitPOAP.name,
      githubHandle: claim.githubUser?.githubHandle ?? null,
      emailId: claim.emailId,
    });
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

  const claimedIds = foundClaims.map((foundClaim: FoundClaim) => foundClaim.claimId);

  if (invalidClaims.length > 0) {
    logger.warn(`Some claims were invalid: ${JSON.stringify(invalidClaims)}`);

    // Return 400 iff no claims were completed
    if (foundClaims.length === 0) {
      return res.status(400).send({
        claimed: claimedIds,
        invalid: invalidClaims,
      });
    }
  }

  void sendInternalClaimMessage(foundClaims, ethAddress, ensName);

  logger.debug(`Completed request claiming IDs ${claimIds} for address ${ethAddress}`);

  res.status(200).send({
    claimed: claimedIds,
    invalid: invalidClaims,
  });

  await runClaimsPostProcessing(claimedIds, qrHashes);
});

claimsRouter.post('/create', jwtWithAdminOAuth(), async function (req, res) {
  const logger = getRequestLogger(req);

  logger.error('[DEPRECATED] POST /claims/create called');

  const schemaResult = CreateGitPOAPClaimsSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { githubOAuthToken } = getAccessTokenPayloadWithGithubOAuth(req.user);

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
    return res.status(404).send({ msg: `There is not GitPOAP with ID: ${req.body.gitPOAPId}` });
  }
  if (gitPOAPData.poapApprovalStatus === GitPOAPStatus.UNAPPROVED) {
    const msg = `GitPOAP ID ${req.body.gitPOAPId} has not been approved yet`;
    logger.warn(msg);
    return res.status(400).send({ msg });
  }
  if (gitPOAPData.poapApprovalStatus === GitPOAPStatus.DEPRECATED) {
    const msg = `GitPOAP ID ${req.body.gitPOAPId} is deprecated`;
    logger.warn(msg);
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

    // Ensure that we've created a GithubUser in our
    // system for the claim
    const githubUser = await upsertGithubUser(githubId, githubUserInfo.login);

    // Upsert so we can rerun the script if necessary
    await context.prisma.claim.upsert({
      where: {
        gitPOAPId_githubUserId: {
          gitPOAPId: gitPOAPData.id,
          githubUserId: githubUser.id,
        },
      },
      update: {},
      create: {
        gitPOAP: {
          connect: {
            id: gitPOAPData.id,
          },
        },
        githubUser: {
          connect: {
            id: githubUser.id,
          },
        },
      },
    });
  }

  if (notFound.length > 0) {
    return res.status(400).send({
      msg: 'Some of the githubIds were not found',
      ids: notFound,
    });
  }

  logger.debug(
    `Completed request to create ${req.body.recipientGithubIds.length} claims for GitPOAP Id: ${req.body.gitPOAPId}`,
  );

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
    const logger = getRequestLogger(req);

    const schemaResult = CreateGitPOAPBotClaimsSchema.safeParse(req.body);
    if (!schemaResult.success) {
      logger.warn(
        `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
      );
      return res.status(400).send({ issues: schemaResult.error.issues });
    }

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
            claimData => claimData.githubUser && githubIdSet.has(claimData.githubUser.githubId),
          );

          newClaims = [...newClaims, ...filteredNewClaims];
        }
      }

      if (wasEarnedByMention && newClaims.length > 0) {
        void sendInternalClaimByMentionMessage(
          organization,
          repo,
          { pullRequestNumber },
          newClaims,
        );
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
            claimData => claimData.githubUser && githubIdSet.has(claimData.githubUser.githubId),
          );

          newClaims = [...newClaims, ...filteredNewClaims];
        } else {
          // 'pullRequest' in contribution
          logger.error('Got back a pull request from createClaimsForIssue');
          return res.status(500).send({ msg: 'createClaimsForIssue failed' });
        }
      }

      if (newClaims.length > 0) {
        void sendInternalClaimByMentionMessage(organization, repo, { issueNumber }, newClaims);
      }

      logger.debug(
        `Completed request to create claim for mention in Issue #${issueNumber} on "${organization}/${repo}"`,
      );
    }

    res.status(200).send({ newClaims });
  },
);

claimsRouter.post('/revalidate', jwtWithAddress(), async (req, res) => {
  const logger = getRequestLogger(req);

  // We have the same body requirements here as in the claim endpoint
  const schemaResult = ClaimGitPOAPSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { address, githubId, githubHandle } = getAccessTokenPayload(req.user);

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
        githubUser: {
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

    if (claim.githubUser?.githubId !== githubId) {
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

  res.status(200).send({
    claimed: foundClaims,
    invalid: [],
  });
});

claimsRouter.delete('/:id', jwtWithAddress(), async (req, res) => {
  const logger = getRequestLogger(req);

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
    return res.status(200).send('DELETED');
  }

  const { addressId, address } = getAccessTokenPayload(req.user);

  if (claim.gitPOAP.type === GitPOAPType.CUSTOM) {
    // If the GitPOAP is CUSTOM ensure that requestor is it's creator
    if (claim.gitPOAP.creatorAddressId === null) {
      logger.error(
        `Custom GitPOAP ID ${claim.gitPOAP.id} does not have an associated creatorAddress`,
      );
      return res.status(500).send({ msg: "Can't authenticate GitPOAP ownership" });
    }

    if (claim.gitPOAP.creatorAddressId !== addressId) {
      logger.warn(
        `User attempted to delete a Claim for a custom GitPOAP (ID: ${claim.gitPOAP.id} that they do not own`,
      );
      return res.status(401).send({ msg: 'Not Custom GitPOAP creator' });
    }
  } else {
    // Otherwise ensure that the requestor is an admin
    if (!isAddressAnAdmin(address)) {
      logger.warn(`Non-admin address ${address} attempted to delete a Claim for a GitPOAP`);
      return res.status(401).send({ msg: 'Not authorized to delete claims' });
    }
  }

  if (claim.status !== ClaimStatus.UNCLAIMED) {
    logger.warn(`User attempted to delete a Claim (ID: ${claimId}) that has already been claimed`);
    return res.status(400).send({ msg: 'Already claimed' });
  }

  // Use deleteMany so we don't fail if another request deletes the record during this request
  await context.prisma.claim.deleteMany({
    where: { id: claimId },
  });

  logger.debug(`Completed request to delete Claim with ID: ${claimId}`);

  return res.status(200).send('DELETED');
});
