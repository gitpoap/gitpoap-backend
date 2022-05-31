require('dotenv').config();

import 'reflect-metadata';
import { backloadGithubPullRequestData } from '../src/lib/pullRequests';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { sleep } from '../src/lib/sleep';

const BACKLOADER_DELAY_BETWEEN_PROJECTS_SECONDS = 30;

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2));

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  const repos = await context.prisma.repo.findMany({
    select: {
      id: true,
    },
  });

  for (let i = 0; i < repos.length; ++i) {
    if (i !== 0) {
      logger.info(
        `Waiting ${BACKLOADER_DELAY_BETWEEN_PROJECTS_SECONDS} seconds before backloading next project`,
      );

      await sleep(BACKLOADER_DELAY_BETWEEN_PROJECTS_SECONDS);
    }

    await backloadGithubPullRequestData(repos[i].id);
  }
};

main();
