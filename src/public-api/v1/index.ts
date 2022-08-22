import { Router } from 'express';
import { context } from '../../context';
import { httpRequestDurationSeconds } from '../../metrics';
import { createScopedLogger } from '../../logging';
import { resolveENSInternal } from '../../external/ens';
import { ClaimStatus } from '@generated/type-graphql';
import { badgen } from 'badgen';
import { GitPOAPMiniLogo } from './constants';
import { mapClaimsToGitPOAPResults } from './helpers';
import { z } from 'zod';
import { poapRouter } from './routes/poap';
import { poapEventRouter } from './routes/poapEvent';
import { gitpoapsRouter } from './routes/gitpoaps';

export const v1Router = Router();

v1Router.use('/poap', poapRouter);
v1Router.use('/poap-event', poapEventRouter);
v1Router.use('/gitpoaps', gitpoapsRouter);

v1Router.get('/address/:address/gitpoaps', async function (req, res) {
  const logger = createScopedLogger('GET /v1/address/:address/gitpoaps');

  logger.info(`Request for GitPOAPs for address "${req.params.address}"`);

  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/v1/address/:address/gitpoaps');

  const resolvedAddress = await resolveENSInternal(req.params.address);
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
      needsRevalidation: true,
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

  const results = await mapClaimsToGitPOAPResults(claims);

  if (results === null) {
    const msg = 'Failed to query POAP data for claims';
    logger.error(msg);
    endTimer({ status: 500 });
    return res.status(500).send({ msg });
  }

  return res.status(200).send(results);
});

v1Router.get('/github/user/:githubHandle/gitpoaps', async function (req, res) {
  const logger = createScopedLogger('GET /v1/github/user/:githubHandle/gitpoaps');
  logger.info(`Request for GitPOAPs for githubHandle "${req.params.githubHandle}"`);
  const endTimer = httpRequestDurationSeconds.startTimer(
    'GET',
    '/v1/github/user/:githubHandle/gitpoaps',
  );

  const QuerySchema = z.object({
    status: z.enum(['claimed', 'unclaimed', 'minting', 'pending']).optional(),
  });

  const schemaResult = QuerySchema.safeParse(req.query);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid query fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  let status: ClaimStatus | undefined = undefined;

  switch (req.query.status) {
    case 'claimed':
      status = ClaimStatus.CLAIMED;
      break;
    case 'unclaimed':
      status = ClaimStatus.UNCLAIMED;
      break;
    case 'pending':
      status = ClaimStatus.PENDING;
      break;
    case 'minting':
      status = ClaimStatus.MINTING;
      break;
  }

  const claims = await context.prisma.claim.findMany({
    where: {
      user: {
        githubHandle: {
          equals: req.params.githubHandle,
        },
      },
      status,
      gitPOAP: {
        isEnabled: true,
      },
    },
    select: {
      id: true,
      createdAt: true,
      mintedAt: true,
      poapTokenId: true,
      pullRequestEarned: true,
      needsRevalidation: true,
      gitPOAP: {
        select: {
          id: true,
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

  const results = await mapClaimsToGitPOAPResults(claims);

  if (results === null) {
    const msg = `Failed to query POAP data for claims`;
    logger.error(msg);
    endTimer({ status: 500 });
    return res.status(500).send({ msg });
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
