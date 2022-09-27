require('dotenv').config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { upsertAddress } from '../src/lib/addresses';

async function populateAddresses() {
  const logger = createScopedLogger('populateAddresses');

  /*
   * 1. First, fetch all profile records & populate addressId for each
   * 2. Additionally, populate ensName and ensAvatarImageUrl on new Address records
   */
  const profiles = await context.prisma.profile.findMany({
    select: {
      id: true,
      oldAddress: true,
      oldEnsAvatarImageUrl: true,
      oldEnsName: true,
      address: true,
    },
  });

  logger.info(`Found ${profiles.length} profiles to update & addresses to create`);

  let updatedProfiles = 0;
  for (const profile of profiles) {
    /* Upsert the new address along w ENS values */
    logger.info(
      `Upserting address ${profile.oldAddress.toLowerCase()} / ensName: ${
        profile.oldEnsName
      } for profile ${profile.id} - `,
    );

    const addressResult = await upsertAddress(
      profile.oldAddress,
      profile.oldEnsName,
      profile.oldEnsAvatarImageUrl,
    );

    /* Associate the address to the profile */
    await context.prisma.profile.update({
      where: { id: profile.id },
      data: {
        address: {
          connect: {
            id: addressResult.id,
          },
        },
      },
    });

    updatedProfiles++;
  }

  logger.info(
    `Updated ${updatedProfiles} profiles and created ${
      profiles.length - updatedProfiles
    } addresses`,
  );

  /*
   * 3. Next, fetch all claim records & populate mintedAddressId for each when oldMintedAddress exists
   */
  const claims = await context.prisma.claim.findMany({});

  logger.info(`Found ${claims.length} claims to populate`);

  let updatedClaimCount = 0;
  let skippedClaimCount = 0;
  for (const claim of claims) {
    if (claim.oldMintedAddress) {
      logger.info(
        `Updating claim ${claim.id} with mintedAddressId ${claim.oldMintedAddress.toLowerCase()}`,
      );
      const addressResult = await context.prisma.address.upsert({
        where: {
          ethAddress: claim.oldMintedAddress,
        },
        create: {
          ethAddress: claim.oldMintedAddress,
        },
        update: {},
      });

      await context.prisma.claim.update({
        where: {
          id: claim.id,
        },
        data: {
          mintedAddress: {
            connect: {
              id: addressResult.id,
            },
          },
        },
      });

      updatedClaimCount++;
    } else {
      logger.warn(`Claim ${claim.id} has no oldMintedAddress - status: ${claim.status}`);
      skippedClaimCount++;
    }
  }

  logger.info(`Updated ${updatedClaimCount} claims`);
  logger.info(`Skipped ${skippedClaimCount} claims`);

  const [profilesCount, profileCountWithAddress, claimCountWithAddress, addressCount] =
    await Promise.all([
      context.prisma.profile.count(),
      context.prisma.profile.count({
        where: {
          addressId: {
            not: null,
          },
        },
      }),
      context.prisma.claim.count({
        where: {
          mintedAddressId: {
            not: null,
          },
        },
      }),
      context.prisma.address.count(),
    ]);

  logger.info(`${profilesCount} profiles were found.`);
  logger.info(`${profileCountWithAddress} profiles now have their addressId set.`);
  logger.info(`${claimCountWithAddress} claims now have their mintedAddressId set.`);
  logger.info(`${addressCount} addresses were created.`);
}

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2));

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  await context.redis.connect();
  logger.info('Connected to redis');

  await populateAddresses();

  await context.redis.disconnect();
};

main();
