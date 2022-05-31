require('dotenv').config();

import 'reflect-metadata';
import { backloadGithubPullRequestData } from '../src/lib/pullRequests';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';

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

  for (const repo of repos) {
    await backloadGithubPullRequestData(repo.id);
  }
};

main();
