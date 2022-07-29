require('dotenv').config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { retrievePOAPEventInfo } from '../src/external/poap';

async function backloadPOAPData() {
  const logger = createScopedLogger('backloadPOAPData');

  const gitPOAPs = await context.prisma.gitPOAP.findMany({
    select: {
      id: true,
      poapEventId: true,
    },
  });

  logger.info(`Backloading POAP data for ${gitPOAPs.length} GitPOAPs`);

  for (const gitPOAP of gitPOAPs) {
    logger.info(`Handling GitPOAP ID ${gitPOAP.id}`);

    // All this should already be in the cash so no need to delay requests
    const eventInfo = await retrievePOAPEventInfo(gitPOAP.poapEventId);
    if (eventInfo === null) {
      logger.error(
        `Failed to retrieve event info (ID: ${gitPOAP.poapEventId}) for GitPOAP ID ${gitPOAP.id}`,
      );
      continue;
    }

    await context.prisma.gitPOAP.update({
      where: {
        id: gitPOAP.id,
      },
      data: {
        name: eventInfo.name,
        imageUrl: eventInfo.image_url,
        description: eventInfo.description,
      },
    });

    logger.debug(`Completed backloading POAP data for ${gitPOAPs.length} GitPOAPs`);
  }
}

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2));

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  await context.redis.connect();
  logger.info('Connected to redis');

  await backloadPOAPData();

  await context.redis.disconnect();
  logger.info('Disconnected from redis');
};

main();
