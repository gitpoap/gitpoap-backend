import { ClaimGitPOAPSchema } from '../schemas/claims';
import { Router } from 'express';
import fetch from 'cross-fetch';
import { context } from '../context';

export const claimsRouter = Router();

claimsRouter.post('/', async function (req, res) {
  const schemaResult = ClaimGitPOAPSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  console.log(
    `Received request to claim GitPOAPs with ids: ${req.body.claim_ids} at address ${req.body.address}`,
  );

  const address = await context.provider.resolveName(req.body.address);

  if (req.body.address !== address) {
    console.log(`Resolved ${req.body.address} to ${address}`);
  }

  res.status(200).send('CLAIMED');
});
