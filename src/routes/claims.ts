import { ClaimGitPOAPSchema, CreateGitPOAPClaimsSchema } from '../schemas/claims';
import { Router } from 'express';
import fetch from 'cross-fetch';
import { context } from '../context';
import { ClaimStatus } from '@prisma/client';
import { resolveENS } from '../util';
import { utils } from 'ethers';
import jwt from 'express-jwt';
import { jwtWithOAuth } from '../middleware';
import { AccessTokenPayload, AccessTokenPayloadWithOAuth } from '../types';
import { claimPOAP, retrievePOAPEventInfo } from '../poap';
import { getGithubUserById } from '../github';
import { JWT_SECRET } from '../environment';

export const claimsRouter = Router();

claimsRouter.post(
  '/',
  jwt({ secret: JWT_SECRET as string, algorithms: ['HS256'] }),
  async function (req, res) {
    if (!req.user) {
      return res.status(401).send({ message: 'Invalid or missing Access Token' });
    }

    const schemaResult = ClaimGitPOAPSchema.safeParse(req.body);

    if (!schemaResult.success) {
      return res.status(400).send({ issues: schemaResult.error.issues });
    }

    console.log(
      `Received request to claim GitPOAPs with ids: ${req.body.claimIds} at address ${req.body.address}`,
    );

    // Resolve ENS if provided
    const resolvedAddress = await resolveENS(context.provider, req.body.address);
    if (resolvedAddress === null) {
      return res.status(400).send({ msg: `${req.body.address} is not a valid address` });
    }

    const recoveredAddress = utils.verifyMessage(
      JSON.stringify(req.body.claimIds),
      req.body.signature,
    );
    if (recoveredAddress !== resolvedAddress) {
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

    // Return 400 iff no claims were completed
    if (foundClaims.length === 0) {
      return res.status(400).send({
        claimed: foundClaims,
        invalid: invalidClaims,
      });
    }

    res.status(200).send({
      claimed: foundClaims,
      invalid: invalidClaims,
    });
  },
);

// TODO: decide how we should be doing auth for this
claimsRouter.post('/create', jwtWithOAuth(), async function (req, res) {
  const schemaResult = CreateGitPOAPClaimsSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  console.log(
    `Received a request to create ${req.body.recipientGithubIds.length} claims for GitPOAP Id: ${req.body.gitPOAPId}`,
  );

  const gitPOAPData = await context.prisma.gitPOAP.findUnique({
    where: {
      id: req.body.gitPOAPId,
    },
  });
  if (gitPOAPData === null) {
    return res.status(404).send({ msg: `There is not GitPOAP with ID: ${req.body.gitPOAPId}` });
  }

  let notFound = [];
  for (const githubId of req.body.recipientGithubIds) {
    const githubUserInfo = await getGithubUserById(
      githubId,
      (<AccessTokenPayloadWithOAuth>req.user).githubOAuthToken,
    );
    if (githubUserInfo === null) {
      console.log(`Github ID ${githubId} not found!`);
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
  } else {
    return res.status(200).send('CREATED');
  }
});
