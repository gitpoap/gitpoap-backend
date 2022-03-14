import { Router } from 'express';
import { AddFeaturedSchema, RemoveFeaturedSchema } from '../schemas/featured';
import fetch from 'cross-fetch';
import { context } from '../context';
import { resolveENS } from '../util';
import { utils } from 'ethers';

export const featuredRouter = Router();

featuredRouter.put('/', async function (req, res) {
  const schemaResult = AddFeaturedSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  console.log(
    `Received a request from ${req.body.address} to feature POAP ID: ${req.body.poapTokenId}`,
  );

  // Resolve ENS if provided
  const resolvedAddress = await resolveENS(context.provider, req.body.address);
  if (resolvedAddress === null) {
    return res.status(400).send({ msg: `${req.body.address} is not a valid address` });
  }

  const recoveredAddress = utils.verifyMessage(
    JSON.stringify({ action: 'add', id: req.body.poapTokenId }),
    req.body.signature,
  );
  if (recoveredAddress !== resolvedAddress) {
    return res.status(401).send({ msg: 'The signature is not valid for this address and data' });
  }

  const profile = await context.prisma.profile.findUnique({
    where: {
      address: resolvedAddress.toLowerCase(),
    },
  });
  if (profile === null) {
    return res.status(404).send({ msg: `There is no profile for the address ${req.body.address}` });
  }

  let poapData;
  try {
    const poapResponse = await fetch(`${process.env.POAP_URL}/token/${req.body.poapTokenId}`);

    if (poapResponse.status >= 400) {
      console.log(await poapResponse.text());
      return res
        .status(400)
        .send({ msg: "Couldn't retrieve info about the POAP from the POAP API" });
    }

    poapData = await poapResponse.json();
  } catch (err) {
    console.log(err);
    return res.status(400).send({ msg: "Couldn't retrieve info about the POAP from the POAP API" });
  }

  if (poapData.owner.toLowerCase() !== resolvedAddress.toLowerCase()) {
    return res.status(401).send({ msg: 'Users cannot feature POAPs they do not own' });
  }

  await context.prisma.featuredPOAP.upsert({
    where: {
      poapTokenId_profileId: {
        poapTokenId: req.body.poapTokenId,
        profileId: profile.id,
      },
    },
    update: {},
    create: {
      poapTokenId: req.body.poapTokenId,
      profileId: profile.id,
    },
  });

  return res.status(200).send('ADDED');
});

featuredRouter.delete('/:id', async function (req, res) {
  const schemaResult = RemoveFeaturedSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  console.log(
    `Received a request from ${req.body.address} to stop featuring POAP ID: ${req.params.id}`,
  );

  // Resolve ENS if provided
  const resolvedAddress = await resolveENS(context.provider, req.body.address);
  if (resolvedAddress === null) {
    return res.status(400).send({ msg: `${req.body.address} is not a valid address` });
  }

  const recoveredAddress = utils.verifyMessage(
    JSON.stringify({ action: 'remove', id: req.params.id }),
    req.body.signature,
  );
  if (recoveredAddress !== resolvedAddress) {
    return res.status(401).send({ msg: 'The signature is not valid for this address and data' });
  }

  const profile = await context.prisma.profile.findUnique({
    where: {
      address: resolvedAddress.toLowerCase(),
    },
  });
  if (profile === null) {
    return res.status(404).send({ msg: `There is no profile for the address ${req.body.address}` });
  }

  await context.prisma.featuredPOAP.delete({
    where: {
      poapTokenId_profileId: {
        poapTokenId: req.params.id,
        profileId: profile.id,
      },
    },
  });

  return res.status(200).send('DELETED');
});
