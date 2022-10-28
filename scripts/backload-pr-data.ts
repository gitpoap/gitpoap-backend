require('dotenv').config();

import 'reflect-metadata';
import { backloadGithubPullRequestData } from '../src/lib/pullRequests';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { sleep } from '../src/lib/sleep';

const BACKLOADER_DELAY_BETWEEN_PROJECTS_SECONDS = 2;

async function backloadRepos(repos: { id: number }[]) {
  const logger = createScopedLogger('backloadRepos');

  for (let i = 0; i < repos.length; ++i) {
    if (i !== 0) {
      logger.info(
        `Waiting ${BACKLOADER_DELAY_BETWEEN_PROJECTS_SECONDS} seconds before backloading next repo`,
      );

      await sleep(BACKLOADER_DELAY_BETWEEN_PROJECTS_SECONDS);
    }

    await backloadGithubPullRequestData(repos[i].id);
  }
}

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2));

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  if ('only' in argv) {
    const repoIds = [argv['only']].concat(argv['_']).map((id: string) => parseInt(id, 10));

    logger.info(`Running only on Repo IDs ${repoIds}`);

    await backloadRepos(repoIds.map(repoId => ({ id: repoId })));
  } else {
    let where;
    if ('from-repo-id' in argv) {
      logger.info(`Running on Repo IDs >= ${argv['from-repo-id']}`);

      where = {
        id: {
          gte: parseInt(argv['from-repo-id'], 10),
        },
      };
    } else if ('from-gitpoap-id' in argv) {
      logger.info(`Running on Repo with GitPOAP IDs >= ${argv['from-gitpoap-id']}`);

      where = {
        project: {
          gitPOAPs: {
            some: {
              id: {
                gte: parseInt(argv['from-gitpoap-id'], 10),
              },
            },
          },
        },
      };
    } else {
      logger.info('Running on all Repo IDs');
    }

    const repos = await context.prisma.repo.findMany({
      where,
      select: {
        id: true,
      },
      orderBy: {
        id: 'desc',
      },
    });

    await backloadRepos(repos);
  }
};

main();
