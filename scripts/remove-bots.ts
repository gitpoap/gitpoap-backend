require('dotenv').config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { sleep } from '../src/lib/sleep';
import { getGithubUserAsAdmin } from '../src/external/github';
import { ClaimStatus } from '@generated/type-graphql';

const DELAY_BETWEEN_USER_LOOKUP_SECONDS = 1;

async function removeBots() {
  const logger = createScopedLogger('removeBots');

  const users = await context.prisma.user.findMany({
    select: {
      id: true,
      githubHandle: true,
    },
  });

  logger.info(`Checking ${users.length} users to remove the robots`);

  for (const user of users) {
    // Sleep so that we don't get rate limited
    sleep(DELAY_BETWEEN_USER_LOOKUP_SECONDS);

    logger.info(`Checking user "${user.githubHandle}"`);

    const githubUserInfo = await getGithubUserAsAdmin(user.githubHandle);
    if (githubUserInfo === null) {
      logger.error(
        `Failed to lookup User (ID: ${user.id}) "${user.githubHandle}" via GitHub API`
      );
      continue;
    }

    if (githubUserInfo.type !== 'Bot') {
      logger.info(`User "${user.githubHandle}" is NOT a bot`);
      continue;
    }

    logger.info(`User "${user.githubHandle} IS a bot!`);

    const completedClaims = await context.prisma.claim.findMany({
      where: {
        userId: user.id,
        NOT: {
          status: ClaimStatus.UNCLAIMED,
        },
      },
    });

    if (completedClaims.length !== 0) {
      logger.error(`GitHub bot (User ID: ${user.id}) "${user.id}" has completed claims`);
      continue;
    }

    logger.info(`Deleting "${user.githubHandle}"'s Claims and User record`);

    await context.prisma.claim.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await context.prisma.user.delete({
      where: {
        id: user.id,
      },
    });
  }

  logger.info(`Finished checking ${users.length} users to remove the robots`);
}

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2));

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  await removeBots();
};

main();
