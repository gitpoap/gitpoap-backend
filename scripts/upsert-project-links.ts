require('dotenv').config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { retrievePOAPEventInfo } from '../src/external/poap';

async function nextGitPOAPWithMissingProjectId() {
  return await context.prisma.gitPOAP.findFirst({
    where: {
      projectId: null,
    },
    select: {
      id: true,
      poapEventId: true,
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
      const poapInfo = await retrievePOAPEventInfo(gitPOAP.poapEventId);
      if (poapInfo === null) {
        logger.error(
          `Failed to look up POAP Event (id: ${gitPOAP.poapEventId} via the API for GitPOAP id: ${gitPOAP.id})`,
        );
        return;
      }

      let name: string;
      if (poapInfo.name.indexOf('Hackathon') !== -1) {
        // Convert: "GitPOAP: 2022 DevConnect Hackathon - GitPOAP Team Contributor"
        // To: "GitPOAP Team"
        const startIndex = poapInfo.name.indexOf('-') + 2;

        name = poapInfo.name.substr(
          startIndex,
          poapInfo.name.indexOf('Contributor') - 1 - startIndex,
        );
      } else {
        // first instance of "20" (e.g. in "2022" or "2015")
        const startIndex = poapInfo.name.indexOf('20') + 5; // skip "2022 "

        name = poapInfo.name.substr(
          startIndex,
          poapInfo.name.indexOf('Contributor') - 1 - startIndex,
        );
      }

      logger.info(`Using project name "${name}" for GitPOAP "${poapInfo.name}"`);

      projectId = (
        await context.prisma.project.create({
          data: {
            name: name,
          },
        })
      ).id;
    }

    logger.info(`Using Project id: ${projectId}`);

    await context.prisma.repo.update({
      where: {
        id: gitPOAP.repo.id,
      },
      data: {
        projectId: projectId,
      },
    });

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
