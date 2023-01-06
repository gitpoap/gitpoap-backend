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
          id: true,
          githubHandle: true,
        },
      },
      email: {
        select: {
          id: true,
          emailAddress: true,
        },
      },
      issuedAddress: {
        select: {
          id: true,
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
  const foundGithubIds = new Set<number>();
  const foundEmailIds = new Set<number>();
  const foundIssuedAddressIds = new Set<number>();
  let rowCount = 0;

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
    if (foundMintedAddressIds.has(claim.mintedAddressId)) {
      continue;
    }
    foundMintedAddressIds.add(claim.mintedAddressId);
    if (claim.githubUser !== null) {
      if (foundGithubIds.has(claim.githubUser.id)) {
        continue;
      }
      foundGithubIds.add(claim.githubUser.id);
    } else if (claim.email !== null) {
      if (foundEmailIds.has(claim.email.id)) {
        continue;
      }
      foundEmailIds.add(claim.email.id);
    } else if (claim.issuedAddress !== null) {
      if (foundIssuedAddressIds.has(claim.issuedAddress.id)) {
        continue;
      }
      foundIssuedAddressIds.add(claim.issuedAddress.id);
    } else {
      logger.error(
        `Claim ID ${claim.id} has status CLAIMED but none of githubUser, email, or issuedAddress is non-null`,
      );
      process.exit(1);
      return;
    }

    resultContent += `${claim.githubUser?.githubHandle ?? ''},`;
    resultContent += `${claim.email?.emailAddress ?? ''},`;
    resultContent += `${claim.issuedAddress?.ethAddress ?? ''},`;
    resultContent += `${claim.mintedAt.toISOString()}\n`;

    if (++rowCount === requestedCount) {
      break;
    }
  }

  if (rowCount !== requestedCount) {
    logger.warn(`There are only ${rowCount} unique users!`);
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
