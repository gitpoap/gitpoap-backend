require('dotenv').config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';

async function nextGitPOAPWithMissingProjectId() {
  return await context.prisma.gitPOAP.findFirst({
    where: {
      projectId: null,
    },
    select: {
      id: true,
      repo: {
        select: {
          id: true,
          name: true,
          projectId: true,
        },
      },
    },
  });
}

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2));

  logger.debug(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  await context.redis.connect();

  logger.info('Connected to redis');

  let count = 0;
  let gitPOAP;
  while ((gitPOAP = await nextGitPOAPWithMissingProjectId()) !== null) {
    count += 1;

    logger.info(`Linking GitPOAP (id: ${gitPOAP.id}) with Repo (id: ${gitPOAP.repo.id})`);

    let projectId = gitPOAP.repo.projectId;

    if (projectId === null) {
      projectId = (await context.prisma.project.create({ data: {} })).id;

      logger.info(`Using a new Project (ID: ${projectId}) for GitPOAP ID ${gitPOAP.id}`);

      await context.prisma.repo.update({
        where: {
          id: gitPOAP.repo.id,
        },
        data: {
          projectId: projectId,
        },
      });
    } else {
      logger.info(`Using existing Project (ID: ${projectId}) for GitPOAP ID ${gitPOAP.id}`);
    }

    await context.prisma.gitPOAP.update({
      where: {
        id: gitPOAP.id,
      },
      data: {
        projectId: projectId,
      },
    });
  }

  logger.info(`Successfully linked ${count} GitPOAPs and Repos via Projects`);

  await context.redis.disconnect();
};

main();
