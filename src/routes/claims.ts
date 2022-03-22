import { ClaimGitPOAPSchema, CreateGitPOAPClaimsSchema } from '../schemas/claims';
import { Router } from 'express';
import fetch from 'cross-fetch';
import { context } from '../context';
import { ClaimStatus } from '@prisma/client';
import { resolveENS } from '../external/ens';
import { utils } from 'ethers';
import jwt from 'express-jwt';
import { jwtWithAdminOAuth } from '../middleware';
import { AccessTokenPayload, AccessTokenPayloadWithOAuth } from '../types/tokens';
import { claimPOAP, retrievePOAPEventInfo } from '../external/poap';
import { getGithubUserById } from '../external/github';
import { JWT_SECRET } from '../environment';
import { createScopedLogger } from '../logging';

export const claimsRouter = Router();

claimsRouter.post(
  '/',
  jwt({ secret: JWT_SECRET as string, algorithms: ['HS256'] }),
  async function (req, res) {
    const logger = createScopedLogger('POST /claims');

    logger.debug(`Body: ${JSON.stringify(req.body)}`);

    if (!req.user) {
      logger.warn('No access token provided');
      return res.status(401).send({ message: 'Invalid or missing Access Token' });
    }

    logger.debug(`Access Token Payload: ${req.user}`);

    const schemaResult = ClaimGitPOAPSchema.safeParse(req.body);

    if (!schemaResult.success) {
      logger.warn(`Missing/invalid body fields in request: ${schemaResult.error.issues}`);
      return res.status(400).send({ issues: schemaResult.error.issues });
    }

    logger.info(`Request claiming IDs ${req.body.claimIds} for address ${req.body.address}`);

    // Resolve ENS if provided
    const resolvedAddress = await resolveENS(req.body.address);
    if (resolvedAddress === null) {
      logger.warn('Request address is invalid');
      return res.status(400).send({ msg: `${req.body.address} is not a valid address` });
    }

    const recoveredAddress = utils.verifyMessage(
      JSON.stringify({
        site: 'gitpoap.io',
        method: 'POST /claims',
        claimIds: req.body.claimIds,
      }),
      req.body.signature,
    );
    if (recoveredAddress !== resolvedAddress) {
      logger.warn('Request signature is invalid');
      return res.status(401).send({ msg: 'The signature is not valid for this address and data' });
    }

    let foundClaims: number[] = [];
    let invalidClaims = [];

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
      foundClaims.push(claimId);

      const poapData = await claimPOAP(
        claim.gitPOAP.poapEventId,
        req.body.address,
        claim.gitPOAP.poapSecret,
      );

      // If minting the POAP failed we need to revert
      if (poapData === null) {
        logger.error(`Failed to mint claim ${claimId} via the POAP API`);

        foundClaims.pop();

        invalidClaims.push({
          claimId: claimId,
          reason: 'Failed to claim via POAP API',
        });

        await context.prisma.claim.update({
          where: {
            id: claimId,
          },
          data: {
            status: ClaimStatus.UNCLAIMED,
          },
        });

        continue;
      }

      // Mark that the POAP has been claimed
      await context.prisma.claim.update({
        where: {
          id: claimId,
        },
        data: {
          status: ClaimStatus.CLAIMED,
          poapTokenId: poapData.id,
        },
      });
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

    res.status(200).send({
      claimed: foundClaims,
      invalid: [],
    });
  },
);

claimsRouter.post('/create', jwtWithAdminOAuth(), async function (req, res) {
  const logger = createScopedLogger('POST /claims/create');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const schemaResult = CreateGitPOAPClaimsSchema.safeParse(req.body);

  if (!schemaResult.success) {
    logger.warn(`Missing/invalid body fields in request: ${schemaResult.error.issues}`);
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info(
    `Request to create ${req.body.recipientGithubIds.length} claims for GitPOAP Id: ${req.body.gitPOAPId}`,
  );

  const gitPOAPData = await context.prisma.gitPOAP.findUnique({
    where: {
      id: req.body.gitPOAPId,
    },
  });
  if (gitPOAPData === null) {
    logger.warn(`GitPOAP ID ${req.body.gitPOAPId} not found`);
    return res.status(404).send({ msg: `There is not GitPOAP with ID: ${req.body.gitPOAPId}` });
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
    }

    // Ensure that we've created a user in our
    // system for the claim
    const user = await context.prisma.user.upsert({
      where: {
        githubId: githubId,
      },
      update: {
        githubHandle: githubUserInfo.login,
      },
      create: {
        githubId: githubId,
        githubHandle: githubUserInfo.login,
      },
    });

    await context.prisma.claim.create({
      data: {
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
    return res.status(400).send({
      msg: 'Some of the githubIds were not found',
      ids: notFound,
    });
  }

  logger.debug(
    `Completed request to create ${req.body.recipientGithubIds.length} claims for GitPOAP Id: ${req.body.gitPOAPId}`,
  );

  return res.status(200).send('CREATED');
});
