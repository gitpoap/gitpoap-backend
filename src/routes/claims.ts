import { ClaimGitPOAPSchema } from '../schemas/claims';
import { Router } from 'express';
import fetch from 'cross-fetch';
import { context } from '../context';
import { ClaimStatus } from '@prisma/client';
import { resolveENS } from '../util';
import { utils } from 'ethers';
import jwt from 'express-jwt';
import { AccessTokenPayload } from '../types';
import { claimPOAPQR } from '../poap';

export const claimsRouter = Router();

claimsRouter.post(
  '/',
  jwt({ secret: process.env.JWT_SECRET as string, algorithms: ['HS256'] }),
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

      // Helper for two exit paths from bad POAP responses
      const revertClaim = async () => {};

      const poapData = await claimPOAPQR(
        req.body.address,
        claim.gitPOAP.poapQRHash,
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
