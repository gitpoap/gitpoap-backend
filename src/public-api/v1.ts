import { Router } from 'express';
import { context } from '../context';
import { httpRequestDurationSeconds } from '../metrics';
import { createScopedLogger } from '../logging';
import { resolveENS } from '../external/ens';
import { retrievePOAPInfo } from '../external/poap';
import { ClaimStatus } from '@generated/type-graphql';
import { DateTime } from 'luxon';

export const v1Router = Router();

v1Router.get('/poap/:poapTokenId/is-gitpoap', async function (req, res) {
  const logger = createScopedLogger('GET /v1/poap/:poapTokenId/is-gitpoap');

  logger.info(`Request to check it POAP token id ${req.params.poapTokenId} is a GitPOAP`);

  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/v1/poap/:poapTokenId/is-gitpoap');

  const gitPOAP = await context.prisma.claim.findUnique({
    where: {
      poapTokenId: req.params.poapTokenId,
    },
    select: {
      gitPOAPId: true,
    },
  });

  endTimer({ status: 200 });

  logger.debug(
    `Completed request to check it POAP token id ${req.params.poapTokenId} is a GitPOAP`,
  );

  if (gitPOAP === null) {
    return res.status(200).send({ isGitPOAP: false });
  }

  return res.status(200).send({
    isGitPOAP: true,
    gitPOAPId: gitPOAP.gitPOAPId,
  });
});

v1Router.get('/poap-event/:poapEventId/is-gitpoap', async function (req, res) {
  const logger = createScopedLogger('GET /v1/poap-event/:poapEventId/is-gitpoap');

  logger.info(
    `Request to check it POAP event id ${req.params.poapEventId} is a GitPOAP project contribution level`,
  );

  const endTimer = httpRequestDurationSeconds.startTimer(
    'GET',
    '/v1/poap-event/:poapEventId/is-gitpoap',
  );

  const gitPOAP = await context.prisma.gitPOAP.findUnique({
    where: {
      poapEventId: parseInt(req.params.poapEventId, 10),
    },
    select: {
      id: true,
    },
  });

  endTimer({ status: 200 });

  logger.info(
    `Completed request to check it POAP event id ${req.params.poapEventId} is a GitPOAP project contribution level`,
  );

  if (gitPOAP === null) {
    return res.status(200).send({ isGitPOAP: false });
  }

  return res.status(200).send({
    isGitPOAP: true,
    gitPOAPId: gitPOAP.id,
  });
});

v1Router.get('/address/:address/gitpoaps', async function (req, res) {
  const logger = createScopedLogger('GET /v1/address/:address/gitpoaps');

  logger.info(`Request for GitPOAPs for address "${req.params.address}"`);

  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/v1/address/:address/gitpoaps');

  const resolvedAddress = await resolveENS(req.params.address);
  if (resolvedAddress === null) {
    logger.warn('Request address is invalid');
    endTimer({ status: 400 });
    return res.status(400).send({ msg: `${req.body.address} is not a valid address` });
  }

  const claims = await context.prisma.claim.findMany({
    where: {
      address: resolvedAddress.toLowerCase(),
      status: ClaimStatus.CLAIMED,
    },
    select: {
      createdAt: true,
      poapTokenId: true,
      pullRequestEarned: true,
      gitPOAP: {
        select: {
          id: true,
          year: true,
          poapEventId: true,
          repo: {
            select: {
              name: true,
              organization: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
  });

  type ResultType = {
    gitPoapId: number;
    poapTokenId: string;
    poapEventId: number;
    name: string;
    year: number;
    description: string;
    imageUrl: string;
    repository: string;
    earnedAt: string;
    createdAt: string;
  };

  let results: ResultType[] = [];

  for (const claim of claims) {
    const poapData = await retrievePOAPInfo(<string>claim.poapTokenId);
    if (poapData === null) {
      const msg = `Failed to query POAP ID "${claim.gitPOAP.poapEventId}" data from POAP API`;
      logger.error(msg);
      endTimer({ status: 500 });
      return res.status(500).send({ msg });
    }

    // Default to created at time of the Claim (e.g. for hackathons)
    const earnedAt = claim.pullRequestEarned
      ? claim.pullRequestEarned.githubMergedAt
      : claim.createdAt;

    results.push({
      gitPoapId: claim.gitPOAP.id,
      poapTokenId: <string>claim.poapTokenId,
      poapEventId: claim.gitPOAP.poapEventId,
      name: poapData.event.name,
      year: claim.gitPOAP.year,
      description: poapData.event.description,
      imageUrl: poapData.event.image_url,
      repository: `${claim.gitPOAP.repo.organization.name}/${claim.gitPOAP.repo.name}`,
      earnedAt: DateTime.fromJSDate(earnedAt).toFormat('yyyy-MM-dd'),
      createdAt: poapData.created,
    });
  }

  return res.status(200).send(results);
});
