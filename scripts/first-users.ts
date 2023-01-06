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
      githubUser: {
        select: {
          githubHandle: true,
        },
      },
      email: {
        select: {
          emailAddress: true,
        },
      },
      issuedAddress: {
        select: {
          ethAddress: true,
        },
      },
      mintedAddressId: true,
    },
    orderBy: {
      mintedAt: 'asc',
    },
  });

  logger.info(`Found ${claims.length} Claims`);

  let resultContent = 'githubHandle,emailAddress,ethAddress,mintedAt\n';
  const foundMintedAddressIds = new Set<number>();

  for (const claim of claims) {
    if (claim.mintedAddressId === null) {
      logger.error(`Claim ID ${claim.id} has status CLAIMED but mintedAddress is null`);
      process.exit(1);
      return;
    }
    if (claim.mintedAt === null) {
      logger.error(`Claim ID ${claim.id} has status CLAIMED but mintedAt is null`);
      process.exit(1);
      return;
    }
    if (claim.githubUser === null && claim.email === null && claim.issuedAddress === null) {
      logger.error(
        `Claim ID ${claim.id} has status CLAIMED but none of githubUser, email, or issuedAddress is non-null`,
      );
      process.exit(1);
      return;
    }
    if (foundMintedAddressIds.has(claim.mintedAddressId)) {
      continue;
    }

    resultContent += `${claim.githubUser?.githubHandle ?? ''},`;
    resultContent += `${claim.email?.emailAddress ?? ''},`;
    resultContent += `${claim.issuedAddress?.ethAddress ?? ''},`;
    resultContent += `${claim.mintedAt.toISOString()}\n`;

    foundMintedAddressIds.add(claim.mintedAddressId);

    if (foundMintedAddressIds.size === requestedCount) {
      break;
    }
  }

  if (foundMintedAddressIds.size !== requestedCount) {
    logger.warn(`There are only ${foundMintedAddressIds.size} unique users!`);
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
