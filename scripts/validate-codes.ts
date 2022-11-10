import { config } from 'dotenv';
config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { retrievePOAPCodes } from '../src/external/poap';

type CodeUsageMap = Record<string, boolean>;

async function generateCodeUsageMap(
  poapEventId: number,
  poapSecretCode: string,
): Promise<{ codeUsageMap: CodeUsageMap; unusedCount: number } | null> {
  const logger = createScopedLogger('generateCodeUsageMap');

  logger.info(`Requesting QR code status from POAP API for POAP Event ID ${poapEventId}`);

  const codeData = await retrievePOAPCodes(poapEventId, poapSecretCode);

  if (codeData === null) {
    logger.error(`Failed to lookup codes for POAP Event ID ${poapEventId}`);
    return null;
  }

  logger.info(`Found ${codeData.length} existing codes`);

  const usages: CodeUsageMap = {};
  let unusedCount = 0;

  for (const codeStatus of codeData) {
    usages[codeStatus.qr_hash] = codeStatus.claimed;
    if (!codeStatus.claimed) {
      ++unusedCount;
    }
  }

  return { codeUsageMap: usages, unusedCount };
}

async function checkGitPOAPCodes(gitPOAPId: number) {
  const logger = createScopedLogger('checkGitPOAPCodes');

  const gitPOAP = await context.prisma.gitPOAP.findUnique({
    where: { id: gitPOAPId },
    select: {
      name: true,
      poapEventId: true,
      poapSecret: true,
    },
  });

  if (gitPOAP === null) {
    logger.error(`Failed to find GitPOAP ID ${gitPOAPId}`);
    return;
  }

  const mapResult = await generateCodeUsageMap(gitPOAP.poapEventId, gitPOAP.poapSecret);

  if (mapResult === null) {
    logger.error(`Couldn't lookup codes for GitPOAP ID ${gitPOAPId}`);
    return;
  }

  const { codeUsageMap, unusedCount } = mapResult;

  logger.info(`POAP API says there are ${unusedCount} unused codes`);

  const gitPOAPCodes = await context.prisma.redeemCode.findMany({
    where: { gitPOAPId },
    select: {
      id: true,
      code: true,
    },
  });

  logger.info(`There are ${gitPOAPCodes} "unused" codes in our database`);

  let notFound = 0;
  let alreadyUsed = 0;

  for (const redeemCode of gitPOAPCodes) {
    if (!(redeemCode.code in codeUsageMap)) {
      logger.error(`RedeemCode ID ${redeemCode.id} not found via POAP API!`);
      ++notFound;
    } else if (codeUsageMap[redeemCode.code]) {
      logger.error(`RedeemCode ID ${redeemCode.id} was already used!`);
      ++alreadyUsed;
    }
  }

  const goodCodes = gitPOAPCodes.length - notFound - alreadyUsed;

  logger.info(
    `The DB has ${goodCodes} unclaimed codes, ${alreadyUsed} claimed codes, and ${notFound} codes weren't found`,
  );

  if (goodCodes === gitPOAPCodes.length) {
    logger.info(`GitPOAP ID ${gitPOAPId} has PASSED validation`);
  } else {
    logger.error(`GitPOAP ID ${gitPOAPId} has FAILED validation`);
  }
}

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2));

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  if (!('_' in argv) || argv['_'].length !== 1) {
    logger.error('The GitPOAP ID must be supplied as a command line argument');
    process.exit(1);
  }

  const gitPOAPId = parseInt(argv['_'][0], 10);

  await checkGitPOAPCodes(gitPOAPId);
};

void main();
