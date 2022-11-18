import { config } from 'dotenv';
config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../logging';
import { registerHandler } from 'segfault-handler';
import minimist from 'minimist';
import { startMetricsServer } from '../metrics';
import { NODE_ENV } from '../environment';
import { PUBLIC_API_PORT } from '../constants';
import { context } from '../context';
import { setupApp } from './app';

const main = async () => {
  const logger = createScopedLogger('main');

  registerHandler('crash.log', (signal, address, stack) => {
    logger.error(`Received ${signal} at ${address}`);
    for (const line of stack) {
      logger.error(line);
    }
  });

  const argv = minimist(process.argv.slice(2));

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  await context.redis.connect();
  logger.info('Connected to redis');

  const app = setupApp();

  app.listen(PUBLIC_API_PORT, () => {
    logger.info(`The application is listening on port ${PUBLIC_API_PORT}`);

    logger.debug(`Environment: ${NODE_ENV}`);
  });

  startMetricsServer();
};

void main();
