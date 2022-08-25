import { Router } from 'express';
import { context } from '../../../context';
import { httpRequestDurationSeconds } from '../../../metrics';
import { createScopedLogger } from '../../../logging';
import { GitPOAPStatus, ClaimStatus } from '@generated/type-graphql';
import { GitPOAPEventResultType } from '../types';
import { mapGitPOAPsToGitPOAPResults } from '../helpers';

export const gitpoapsRouter = Router();

gitpoapsRouter.get('/:gitpoapId/addresses', async function (req, res) {
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

gitpoapsRouter.get('/addresses', async function (req, res) {
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

gitpoapsRouter.get('/events', async (req, res) => {
  const logger = createScopedLogger('GET /v1/gitpoaps/events');

  logger.info('Request for all GitPOAP events');

  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/v1/gitpoaps/events');

  const gitPOAPs = await context.prisma.gitPOAP.findMany({
    where: {
      isEnabled: true,
      NOT: {
        status: GitPOAPStatus.DEPRECATED,
      },
    },
    select: {
      id: true,
      poapEventId: true,
      project: {
        select: {
          repos: {
            select: {
              name: true,
              organization: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
      // Would have used _count but we can't have a where
      claims: {
        where: {
          status: ClaimStatus.CLAIMED,
        },
        select: {
          id: true,
        },
      },
    },
  });

  const results = await mapGitPOAPsToGitPOAPResults(gitPOAPs);

  if (results === null) {
    const msg = 'Failed to query POAP data for claims';
    logger.error(msg);
    endTimer({ status: 500 });
    return res.status(500).send({ msg });
  }

  endTimer({ status: 200 });

  logger.debug('Completed request for all GitPOAP events');

  return res.status(200).send({ gitPoapEvents: results });
});
