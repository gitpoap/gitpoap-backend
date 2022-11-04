import { config } from 'dotenv';
config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { ClaimStatus } from '@prisma/client';
import { writeFile } from 'fs/promises';

async function findFirstUsers(requestedCount: number) {
  const logger = createScopedLogger('findFirstUsers');

  const claims = await context.prisma.claim.findMany({
    where: {
      status: ClaimStatus.CLAIMED,
    },
    select: {
      id: true,
      mintedAt: true,
      user: {
        select: {
          githubHandle: true,
          githubId: true,
        },
      },
    },
    orderBy: {
      mintedAt: 'asc',
    },
  });

  logger.info(`Found ${claims.length} Claims`);

  let resultContent = 'githubHandle,githubId,mintedAt\n';
  const foundGithubIds = new Set<number>();

  for (const claim of claims) {
    if (claim.user && !foundGithubIds.has(claim.user.githubId)) {
      if (claim.mintedAt === null) {
        logger.error(`Claim ID ${claim.id} has status CLAIMED but mintedAt is null`);
        continue;
      }

      const mintedAt = claim.mintedAt.toISOString();

      resultContent += `${claim.user.githubHandle},${claim.user.githubId},${mintedAt}\n`;

      foundGithubIds.add(claim.user.githubId);

      if (foundGithubIds.size === requestedCount) {
        break;
      }
    }
  }

  if (foundGithubIds.size !== requestedCount) {
    logger.warn(`There are only ${foundGithubIds.size} unique users!`);
  } else {
    logger.info(`Found the first ${requestedCount} unique users`);
  }

  await writeFile(`first-${requestedCount}-users.csv`, resultContent);
}

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2));

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  if (!('_' in argv) || argv['_'].length !== 1) {
    logger.error('A single number of users must be supplied as a command line argument');
    process.exit(1);
  }

  const count = parseInt(argv['_'][0], 10);

  await findFirstUsers(count);
};

void main();
