import { ClaimGitPOAPSchema } from '../schemas/claims';
import { Router } from 'express';
import fetch from 'cross-fetch';
import { context } from '../context';
import { ClaimStatus } from '@prisma/client';
import { utils } from 'ethers';

export const claimsRouter = Router();

claimsRouter.post('/', async function (req, res) {
  const schemaResult = ClaimGitPOAPSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  console.log(
    `Received request to claim GitPOAPs with ids: ${req.body.claimIds} at address ${req.body.address}`,
  );

  // Resolve ENS if provided
  const resolvedAddress = await context.provider.resolveName(req.body.address);
  if (req.body.address !== resolvedAddress) {
    console.log(`Resolved ${req.body.address} to ${resolvedAddress}`);
    if (resolvedAddress === null) {
      return res.status(400).send({ msg: `${req.body.address} is not a valid address` });
    }
  }

  const recoveredAddress = utils.verifyMessage(
    JSON.stringify(req.body.claimIds),
    req.body.signature,
  );
  if (recoveredAddress !== resolvedAddress) {
    return res.status(401).send({ msg: 'The signature is not valid for this address and data' });
  }

  let foundClaims = [];
  let invalidClaims = [];

  for (var claimId of req.body.claimIds) {
    const claim = await context.prisma.claim.findUnique({
      where: {
        id: claimId,
      },
      include: {
        user: true,
      },
    });

    if (!claim) {
      invalidClaims.push({
        claim_id: claimId,
        reason: "Claim ID doesn't exist",
      });
      continue;
    }

    // Check to ensure the claim has not already been processed
    if (claim.status !== ClaimStatus.UNCLAIMED) {
      invalidClaims.push({
        claim_id: claimId,
        reason: `Claim has status '${claim.status}'`,
      });
      continue;
    }

    // Ensure the user is the owner of the claim
    // TODO: how to do validation?
    if (claim.user.githubId !== req.body.githubUserId) {
      invalidClaims.push({
        claim_id: claimId,
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

    // TODO: call POAP API

    // Mark that the POAP has been claimed
    await context.prisma.claim.update({
      where: {
        id: claimId,
      },
      data: {
        status: ClaimStatus.CLAIMED,
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
});
