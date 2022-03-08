import { UpdateProfileSchema } from '../schemas/profiles';
import { Router } from 'express';
import { context } from '../context';
import { resolveENS } from '../util';
import { utils } from 'ethers';

export const profilesRouter = Router();

profilesRouter.post('/', async function (req, res) {
  const schemaResult = UpdateProfileSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  console.log(`Received request to update profile for address: ${req.body.address}`);

  const resolvedAddress = await resolveENS(context.provider, req.body.address);
  if (resolvedAddress === null) {
    return res.status(400).send({ msg: `${req.body.address} is not a valid address` });
  }

  // Validate the signature for the updates
  const recoveredAddress = utils.verifyMessage(JSON.stringify(req.body.data), req.body.signature);
  if (recoveredAddress !== resolvedAddress) {
    return res.status(401).send({ msg: 'The signature is not valid for this address and data' });
  }

  try {
    await context.prisma.profile.update({
      where: {
        address: (<string>resolvedAddress).toLowerCase(),
      },
      data: req.body.data,
    });
  } catch (err) {
    return res.status(404).send({ msg: `No profile found for address: ${req.body.address}` });
  }

  return res.status(200).send('UPDATED');
});
