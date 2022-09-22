require('dotenv').config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { sleep } from '../src/lib/sleep';
import { resolveAddress } from '../src/lib/ens';
import { ClaimStatus } from '@generated/type-graphql';

const HEATER_DELAY_BETWEEN_ADDRESSES_SECONDS = 1;

async function heatUpAvatarCache() {
  const logger = createScopedLogger('heatUpAvatarCache');

  // Only run on profiles without the avatars setup
  const addresses = (
    await context.prisma.profile.findMany({
      where: {
        oldEnsAvatarImageUrl: null,
      },
      select: {
        oldAddress: true,
      },
    })
  ).map(p => p.oldAddress);

  logger.info(`Checking ${addresses.length} addresses for ENS Avatars`);

  let checkedCount = 0;
  for (const address of addresses) {
    // Let's skip profiles that are unlikely to show up
    // on the site unless directly navigated to by skipping
    // profiles with less than 1 claim
    const claimsCount = await context.prisma.claim.count({
      where: {
        oldMintedAddress: address,
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
      true, // Run the ENS avatar check synchronously
    );

    sleep(HEATER_DELAY_BETWEEN_ADDRESSES_SECONDS);
  }

  const skipped = addresses.length - checkedCount;
  logger.info(`${checkedCount} profiles were checked for ENS avatars (${skipped} were skipped)`);

  const avatarCount = await context.prisma.profile.count({
    where: {
      NOT: {
        oldEnsAvatarImageUrl: null,
      },
    },
  });

  logger.info(`${avatarCount} profiles have ENS avatars`);
}

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2));

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  await context.redis.connect();
  logger.info('Connected to redis');

  await heatUpAvatarCache();

  await context.redis.disconnect();
};

main();
