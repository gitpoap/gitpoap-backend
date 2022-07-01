import { Router } from 'express';
import { context } from '../context';
import { httpRequestDurationSeconds } from '../metrics';
import { createScopedLogger } from '../logging';
import { resolveENS } from '../external/ens';
import { retrievePOAPInfo } from '../external/poap';
import { ClaimStatus } from '@generated/type-graphql';
import { DateTime } from 'luxon';
import { badgen } from 'badgen';
import { GitPOAPMiniLogo } from './constants';

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

v1Router.get('/gitpoaps/:gitpoapId/addresses', async function (req, res) {
  const logger = createScopedLogger('GET /v1/gitpoaps/:gitpoapId/addresses');
  logger.info(`Request to get all addresses that possess GitPOAP id ${req.params.gitpoapId}`);
  const endTimer = httpRequestDurationSeconds.startTimer(
    'GET',
    '/v1/gitpoaps/:gitpoapId/addresses',
  );

  const gitPOAPId = parseInt(req.params.gitpoapId, 10);
  const gitPOAP = await context.prisma.gitPOAP.findUnique({
    where: {
      id: gitPOAPId,
    },
  });

  if (gitPOAP === null) {
    const msg = 'GitPOAP not found';
    logger.warn(msg);
    endTimer({ status: 404 });
    return res.status(404).send({ message: msg });
  }

  const addresses = await context.prisma.claim.findMany({
    where: {
      gitPOAPId,
      address: {
        not: null,
      },
    },
    select: {
      address: true,
    },
  });

  const mappedAddresses = addresses.map(address => address.address);
  endTimer({ status: 200 });
  logger.info(
    `Completed request to get all addresses that possess GitPOAP id ${req.params.gitpoapId}`,
  );

  return res.status(200).send({ addresses: mappedAddresses });
});

v1Router.get('/gitpoaps/addresses', async function (req, res) {
  const logger = createScopedLogger('GET /v1/gitpoaps/addresses');
  logger.info(`Request to get all addresses that possess any GitPOAP`);
  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/v1/gitpoaps/addresses');

  const addresses = await context.prisma.claim.findMany({
    distinct: ['address'],
    where: {
      address: {
        not: null,
      },
    },
    select: {
      address: true,
    },
  });

  const mappedAddresses = addresses.map(address => address.address);
  endTimer({ status: 200 });
  logger.info(`Completed request to get all addresses that possess any GitPOAP`);

  return res.status(200).send({ addresses: mappedAddresses });
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
      id: true,
      createdAt: true,
      mintedAt: true,
      poapTokenId: true,
      pullRequestEarned: true,
      gitPOAP: {
        select: {
          id: true,
          year: true,
          poapEventId: true,
          project: {
            select: {
              repos: {
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
      },
    },
  });

  type ResultType = {
    gitPoapId: number;
    gitPoapEventId: number;
    poapTokenId: string;
    poapEventId: number;
    name: string;
    year: number;
    description: string;
    imageUrl: string;
    repositories: string[];
    earnedAt: string;
    mintedAt: string;
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

    const repositories = claim.gitPOAP.project.repos.map(repo => {
      return `${repo.organization.name}/${repo.name}`;
    });

    // Default to created at time of the Claim (e.g. for hackathons)
    const earnedAt = claim.pullRequestEarned
      ? claim.pullRequestEarned.githubMergedAt
      : claim.createdAt;

    results.push({
      gitPoapId: claim.id,
      gitPoapEventId: claim.gitPOAP.id,
      poapTokenId: <string>claim.poapTokenId,
      poapEventId: claim.gitPOAP.poapEventId,
      name: poapData.event.name,
      year: claim.gitPOAP.year,
      description: poapData.event.description,
      imageUrl: poapData.event.image_url,
      repositories,
      earnedAt: DateTime.fromJSDate(earnedAt).toFormat('yyyy-MM-dd'),
      mintedAt: DateTime.fromJSDate(<Date>claim.mintedAt).toFormat('yyyy-MM-dd'),
    });
  }

  return res.status(200).send(results);
});

v1Router.get('/repo/:owner/:name/badge', async (req, res) => {
  const logger = createScopedLogger('GET /v1/repo/:owner/:name/badge');

  logger.info(`Request for GitHub badge for the repo "${req.params.owner}/${req.params.name}"`);

  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/v1/repo/:owner/:name/badge');

  const claimsCount = await context.prisma.claim.count({
    where: {
      status: ClaimStatus.CLAIMED,
      gitPOAP: {
        project: {
          repos: {
            some: {
              organization: {
                name: req.params.owner,
              },
              name: req.params.name,
            },
          },
        },
      },
    },
  });

  const repo = await context.prisma.repo.findFirst({
    select: {
      id: true,
    },
    where: {
      organization: {
        name: req.params.owner,
      },
      name: req.params.name,
    },
  });

  //~ See https://github.com/badgen/badgen
  const badgeSvg = badgen({
    label: 'GitPOAPs',
    status: `${claimsCount}`,
    color: '307AE8', // Hex color for GitPOAP Blue
    icon: `data:image/svg+xml;utf8,${encodeURIComponent(GitPOAPMiniLogo)}`,
  });

  endTimer({ status: 200 });

  logger.debug(
    `Completed request for GitHub badge for the repo "${req.params.owner}/${req.params.name}"`,
  );

  res.set({
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'max-age=0, no-cache, no-store, must-revalidate',
  });

  return res.status(200).send(badgeSvg);
});
