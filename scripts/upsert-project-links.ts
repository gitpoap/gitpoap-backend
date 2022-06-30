require('dotenv').config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2));

  logger.debug(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  const gitPOAPs = await context.prisma.gitPOAP.findMany({
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

  if (gitPOAPs.length === 0) {
    logger.info('No GitPOAPs with missing links found');
    return;
  }

  for (const gitPOAP of gitPOAPs) {
    if (gitPOAP.repo.projectId !== null) {
      logger.error(
        `Encountered a GitPOAP (id: ${gitPOAP.id}) whose Repo (id: ${gitPOAP.repo.id}) already has a Project (id: ${gitPOAP.repo.projectId})`,
      );
      process.exit(1);
      return;
    }

    logger.info(`Linking GitPOAP (id: ${gitPOAP.id}) with Repo (id: ${gitPOAP.repo.id})`);

    const project = await context.prisma.project.create({
      data: {
        name: gitPOAP.repo.name,
      },
    });

    logger.info(`Using Project id: ${project.id}`);

    await context.prisma.repo.update({
      where: {
        id: gitPOAP.repo.id,
      },
      data: {
        projectId: project.id,
      },
    });

    await context.prisma.gitPOAP.update({
      where: {
        id: gitPOAP.id,
      },
      data: {
        projectId: project.id,
      },
    });
  }

  logger.info(`Successfully linked ${gitPOAPs.length} GitPOAPs and Repos via Projects`);
};

main();
