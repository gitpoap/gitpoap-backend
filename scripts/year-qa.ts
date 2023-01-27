import { config } from 'dotenv';
config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { GitPOAPType } from '@prisma/client';

async function runAnnualGitPOAPYearQA(year: number) {
  const logger = createScopedLogger('runAnnualGitPOAPYearQA');

  logger.info(`Running ANNUAL GitPOAP QA for year ${year}`);

  const lastYear = year - 1;

  const gitPOAPs = await context.prisma.gitPOAP.findMany({
    where: {
      type: GitPOAPType.ANNUAL,
      year: lastYear,
    },
    select: {
      id: true,
      name: true,
      projectId: true,
    },
  });

  logger.info(`Found ${gitPOAPs.length} ANNUAL GitPOAPs for ${lastYear}`);

  let issueCount = 0;

  for (const gitPOAP of gitPOAPs) {
    const nextGitPOAP = await context.prisma.gitPOAP.findFirst({
      where: {
        year,
        projectId: gitPOAP.projectId,
      },
    });

    if (nextGitPOAP === null) {
      logger.error(`There is no ${year} GitPOAP after "${gitPOAP.name}" (ID: ${gitPOAP.id})`);
      ++issueCount;
    }
  }

  if (issueCount === 0) {
    logger.info(`All Projects have ${year} GitPOAPs 🫡`);
  } else {
    logger.error(`${issueCount} Projects are missing GitPOAPs for ${year} 🫠`);
  }
}

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2));

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  if (!('_' in argv) || argv['_'].length !== 1) {
    logger.error('Expected year to be provided as an argument');
    process.exit(1);
    return;
  }

  await runAnnualGitPOAPYearQA(parseInt(argv['_'][0], 10));
};

void main();
