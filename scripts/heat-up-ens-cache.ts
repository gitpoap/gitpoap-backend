require('dotenv').config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { sleep } from '../src/lib/sleep';
import { resolveAddress } from '../src/lib/ens';
import { ClaimStatus } from '@generated/type-graphql';

const HEATER_DELAY_BETWEEN_ADDRESSES_SECONDS = 1;

async function heatUpENSCache() {
  const logger = createScopedLogger('heatUpENSCache');

  // Only run on profiles without the avatars setup
  const addresses = (
    await context.prisma.profile.findMany({
      where: {
        OR: [
          {
            address: {
              ensName: null,
            },
          },
          {
            address: {
              ensAvatarImageUrl: null,
            },
          },
        ],
      },
      select: {
        address: true,
      },
    })
  ).map(p => p.address.ethAddress);

  logger.info(`Checking ${addresses.length} addresses for ENS names/avatars`);

  let checkedCount = 0;
  for (const address of addresses) {
    // Let's skip profiles that are unlikely to show up
    // on the site unless directly navigated to by skipping
    // profiles with less than 1 claim
    const claimsCount = await context.prisma.claim.count({
      where: {
        mintedAddress: {
          ethAddress: address,
        },
        status: ClaimStatus.CLAIMED,
      },
    });
    if (claimsCount < 1) {
      logger.info(`Skipping address ${address} with 0 GitPOAPs`);
      continue;
    }

    checkedCount += 1;

    logger.info(`Checking address ${address}`);

    // This will force the ENS avatar cache to get populated if the user
    // has an ENS avatar
    await resolveAddress(
      address,
      true, // Force re-checking of the ENS avatar
      true, // Run the ENS checks synchronously
    );

    sleep(HEATER_DELAY_BETWEEN_ADDRESSES_SECONDS);
  }

  const skipped = addresses.length - checkedCount;
  logger.info(
    `${checkedCount} profiles were checked for ENS names/avatars (${skipped} were skipped)`,
  );

  const [nameCount, avatarCount] = await Promise.all([
    context.prisma.profile.count({
      where: {
        address: {
          NOT: {
            ensName: null,
          },
        },
      },
    }),
    context.prisma.profile.count({
      where: {
        address: {
          NOT: {
            ensAvatarImageUrl: null,
          },
        },
      },
    }),
  ]);

  logger.info(`${nameCount} profiles have ENS names`);
  logger.info(`${avatarCount} profiles have ENS avatars`);
}

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2));

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  await context.redis.connect();
  logger.info('Connected to redis');

  await heatUpENSCache();

  await context.redis.disconnect();
};

main();
