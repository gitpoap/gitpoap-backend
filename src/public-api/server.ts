require('dotenv').config();

import express from 'express';
import cors from 'cors';
import { createScopedLogger, updateLogLevel } from '../logging';
import { registerHandler } from 'segfault-handler';
import minimist from 'minimist';
import { errorHandler } from '../middleware';
import { startMetricsServer } from '../metrics';
import { NODE_ENV } from '../environment';
import { PUBLIC_API_PORT } from '../constants';

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

  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/', (req, res) => {
    res.send('GitPOAP Public API Server');
  });

  app.use(errorHandler);

  app.listen(PUBLIC_API_PORT, () => {
    logger.info(`The application is listening on port ${PUBLIC_API_PORT}`);

    logger.debug(`Environment: ${NODE_ENV}`);
  });

  startMetricsServer();
};

main();
