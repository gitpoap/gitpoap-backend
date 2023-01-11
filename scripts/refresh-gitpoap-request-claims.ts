import { config } from 'dotenv';
config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { convertContributorsFromSchema, createClaimsForContributors } from '../src/lib/gitpoaps';
import { Prisma } from '@prisma/client';

async function refreshGitPOAPRequestContributors(gitPOAPRequestId: number) {
  const logger = createScopedLogger('refreshGitPOAPRequestContributors');

  logger.info(`Refreshing Claims for GitPOAP Request ID ${gitPOAPRequestId}`);

  const gitPOAPRequest = await context.prisma.gitPOAPRequest.findUnique({
    where: { id: gitPOAPRequestId },
    select: { contributors: true },
  });
  if (gitPOAPRequest === null) {
    logger.error(`Failed to lookup GitPOAP Request ID ${gitPOAPRequestId}`);
    process.exit(1);
    return;
  }

  const gitPOAP = await context.prisma.gitPOAP.findUnique({
    where: { gitPOAPRequestId },
    select: { id: true },
  });
  if (gitPOAP === null) {
    logger.error(`GitPOAP Request ID ${gitPOAPRequestId} has no associated GitPOAP`);
    process.exit(1);
    return;
  }

  logger.info(`GitPOAP Request ID ${gitPOAPRequestId} corresponds with GitPOAP ID ${gitPOAP.id}`);

  const contributorCount = await createClaimsForContributors(
    gitPOAP.id,
    convertContributorsFromSchema(gitPOAPRequest.contributors as Prisma.JsonObject),
  );

  logger.info(`Refreshed ${contributorCount} Claims for GitPOAP Request ID ${gitPOAPRequestId}`);
}

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2));

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  if (!('_' in argv) || argv['_'].length !== 1) {
    logger.error('A single GitPOAP Request ID must be supplied as a command line argument');
    process.exit(1);
  }

  const gitPOAPRequestId = parseInt(argv['_'][0], 10);

  await context.redis.connect();
  logger.info('Connected to redis');

  await refreshGitPOAPRequestContributors(gitPOAPRequestId);

  await context.redis.disconnect();
};

void main();
