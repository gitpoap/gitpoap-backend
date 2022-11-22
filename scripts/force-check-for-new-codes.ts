import { config } from 'dotenv';
config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { GitPOAPStatus } from '@prisma/client';
import { checkGitPOAPForNewCodesWithApprovalEmail } from '../src/lib/codes';

async function forceCheckForNewCodes() {
  const logger = createScopedLogger('forceCheckForNewCodes');

  // Only run on APPROVED GitPOAPs since the background process checks
  // the other two states
  const gitPOAPs = await context.prisma.gitPOAP.findMany({
    where: { poapApprovalStatus: GitPOAPStatus.APPROVED },
    select: {
      id: true,
      poapApprovalStatus: true,
      poapEventId: true,
      poapSecret: true,
      name: true,
      type: true,
      description: true,
      organization: true,
      creatorAddress: {
        select: {
          email: {
            select: {
              emailAddress: true,
            },
          },
        },
      },
      imageUrl: true,
      creatorEmail: true,
      gitPOAPRequest: true,
    },
  });

  logger.info(`Force-running check for new codes for ${gitPOAPs.length} GitPOAPs`);

  for (const gitPOAP of gitPOAPs) {
    await checkGitPOAPForNewCodesWithApprovalEmail(gitPOAP);
  }
}

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2));

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  await context.redis.connect();
  logger.info('Connected to redis');

  await forceCheckForNewCodes();

  await context.redis.disconnect();
};

void main();
