import { ClaimStatus, GitPOAPStatus, GitPOAPType } from '@prisma/client';
import { Request, Router } from 'express';
import { DateTime } from 'luxon';
import { z } from 'zod';
import { context } from '../context';
import { getGithubUserByIdAsApp } from '../external/github';
import { redeemPOAP } from '../external/poap';
import { shortenAddress } from '../lib/addresses';
import { BotCreateClaimsErrorType, createClaimsForIssue, createClaimsForPR } from '../lib/bot';
import {
  ensureRedeemCodeThreshold,
  retrieveClaimsCreatedByMention,
  retrieveClaimsCreatedByPR,
  runClaimsPostProcessing,
  updateClaimStatusById,
} from '../lib/claims';
import { chooseUnusedRedeemCode, deleteRedeemCode, upsertRedeemCode } from '../lib/codes';
import { RestrictedContribution } from '../lib/contributions';
import { upsertGithubUser } from '../lib/githubUsers';
import { backloadGithubPullRequestData } from '../lib/pullRequests';
import { isAddressAStaffMember } from '../lib/staff';
import { checkIfClaimTransferred } from '../lib/transfers';
import { gitpoapBotAuth, jwtWithAddress, jwtWithStaffAccess } from '../middleware/auth';
import { getRequestLogger } from '../middleware/loggingAndTiming';
import {
  ClaimGitPOAPSchema,
  CreateGitPOAPBotClaimsSchema,
  CreateGitPOAPClaimsSchema,
} from '../schemas/claims';
import { getAccessTokenPayloadWithAddress } from '../types/authTokens';
import { ClaimData, FoundClaim } from '../types/claims';

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

  console.log('mint attempt');
  console.log(req.user);

  const { address, email, github } = getAccessTokenPayloadWithAddress(req.user);
  const { claimIds } = schemaResult.data;

  logger.info(`Request claiming IDs ${claimIds} for address ${address.ethAddress}`);

  const foundClaims: FoundClaim[] = [];
  const qrHashes: string[] = [];
  const invalidClaims: { claimId: number; reason: string }[] = [];

  for (const claimId of claimIds) {
    const claim = await context.prisma.claim.findUnique({
      where: { id: claimId },
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
        `User with address: ${shortenAddress(address.ethAddress)} (ID: ${
          address.id
        }) attempted to claim a non-enabled GitPOAP`,
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

    // Check that the user is minting a GitPOAP that belongs to them
    if (claim.githubUser?.githubId && github) {
      // GitPOAP is issued to a github user, let's verify that it is the correct one
      if (claim.githubUser?.githubId !== github.githubId) {
        invalidClaims.push({
          claimId,
          reason: `User doesn't own github-based claim`,
        });
        continue;
      }
    } else if (claim.emailId && email) {
      // GitPOAP is issued to an email user, let's verify that it is the correct one
      if (claim.emailId !== email.id) {
        invalidClaims.push({
          claimId,
          reason: `User doesn't own email-based claim`,
        });
        continue;
      }
    } else if (claim.issuedAddressId && address) {
      // GitPOAP is issued to an address, let's verify that it is the correct one
      if (claim.issuedAddressId !== address.id) {
        invalidClaims.push({
          claimId,
          reason: `User doesn't own address-based claim`,
        });
        continue;
      }
    } else {
      // Mark invalid because not issued to anyone
      // This shouldn't happen
      invalidClaims.push({
        claimId,
        reason: `Mismatch of claim ownership`,
      });
      continue;
    }

    const redeemCode = await chooseUnusedRedeemCode(claim.gitPOAP);
    if (redeemCode === null) {
      const msg = `GitPOAP ID ${claim.gitPOAP.id} has no more redeem codes (Claim ID: ${claim.id})`;
      logger.error(msg);
      invalidClaims.push({ claimId, reason: msg });
      continue;
    }

    await deleteRedeemCode(redeemCode.id);
    await updateClaimStatusById(claimId, ClaimStatus.PENDING, address.id);

    const poapData = await redeemPOAP(address.ethAddress, redeemCode.code);
    // If minting the POAP failed we need to revert
    if (poapData === null) {
      logger.error(`Failed to mint claim ${claimId} via the POAP API (Claim ID: ${claim.id})`);

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
      poapEventId: claim.gitPOAP.poapEventId,
      mintedAddress: address.ethAddress,
    });
    qrHashes.push(poapData.qr_hash);

    // Mark that the POAP has been claimed
    await context.prisma.claim.update({
      where: { id: claimId },
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

  logger.debug(`Completed request claiming IDs ${claimIds} for address ${address.ethAddress}`);

  res.status(200).send({
    claimed: claimedIds,
    invalid: invalidClaims,
  });

  // Run in the background
  void runClaimsPostProcessing(
    claimedIds.map((id, i) => ({
      id,
      qrHash: qrHashes[i],
      gitPOAP: {
        id: foundClaims[i].gitPOAPId,
        poapEventId: foundClaims[i].poapEventId,
      },
      mintedAddress: { ethAddress: foundClaims[i].mintedAddress },
    })),
  );
});

claimsRouter.post('/create', jwtWithStaffAccess(), async function (req, res) {
  const logger = getRequestLogger(req);

  logger.error('[DEPRECATED] POST /claims/create called');

  const schemaResult = CreateGitPOAPClaimsSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
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
            select: { id: true },
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
    const githubUserInfo = await getGithubUserByIdAsApp(githubId);
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
          connect: { id: gitPOAPData.id },
        },
        githubUser: {
          connect: { id: githubUser.id },
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

      const startTime = DateTime.utc();

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
            // If the claims were not created by an explicit mention, don't renotify
            // recipients of claims they have already earned (but not completed)
            startTime,
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

  const { address, github } = getAccessTokenPayloadWithAddress(req.user);

  if (github === null) {
    logger.warn(
      `Address ${address.ethAddress} attempted to revalidate while not logged into GitHub`,
    );
    return res.status(400).send({ msg: 'Not logged into GitHub' });
  }

  logger.info(
    `Request to revalidate GitPOAP IDs ${req.body.claimIds} by GitHub user ${github.githubHandle}`,
  );

  const foundClaims: number[] = [];
  const invalidClaims: { claimId: number; reason: string }[] = [];

  for (const claimId of req.body.claimIds) {
    const claim = await context.prisma.claim.findUnique({
      where: { id: claimId },
      select: {
        status: true,
        mintedAddress: true,
        githubUser: {
          select: { githubId: true },
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
    if (claim.mintedAddress?.ethAddress !== address.ethAddress) {
      const newAddress = await checkIfClaimTransferred(claimId);

      if (newAddress?.toLowerCase() !== address.ethAddress) {
        invalidClaims.push({
          claimId,
          reason: 'Logged-in Address is not the current owner',
        });
        continue;
      }
    }

    if (claim.githubUser?.githubId !== github.githubId) {
      invalidClaims.push({
        claimId,
        reason: 'User does not own claim',
      });
    }

    await context.prisma.claim.update({
      where: { id: claimId },
      data: { needsRevalidation: false },
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
    `Completed request to revalidate GitPOAP IDs ${req.body.claimIds} by GitHub user ${github.githubHandle}`,
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

  const { address } = getAccessTokenPayloadWithAddress(req.user);

  if (claim.gitPOAP.type === GitPOAPType.CUSTOM) {
    // If the GitPOAP is CUSTOM ensure that requestor is it's creator
    if (claim.gitPOAP.creatorAddressId === null) {
      logger.error(
        `Custom GitPOAP ID ${claim.gitPOAP.id} does not have an associated creatorAddress`,
      );
      return res.status(500).send({ msg: "Can't authenticate GitPOAP ownership" });
    }

    if (claim.gitPOAP.creatorAddressId !== address.id) {
      logger.warn(
        `User ${address.ethAddress} attempted to delete a Claim for a custom GitPOAP (ID: ${claim.gitPOAP.id}) that they do not own`,
      );
      return res.status(401).send({ msg: 'Not Custom GitPOAP creator' });
    }
  } else {
    // Otherwise ensure that the requestor is a staff member
    if (!isAddressAStaffMember(address.ethAddress)) {
      logger.warn(
        `Non-staff address ${address.ethAddress} attempted to delete a Claim for a GitPOAP`,
      );
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
