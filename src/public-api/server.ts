import { config } from 'dotenv';
config();

import express from 'express';
import 'reflect-metadata';
import cors from 'cors';
import { createScopedLogger, updateLogLevel } from '../logging';
import { registerHandler } from 'segfault-handler';
import minimist from 'minimist';
import { errorHandler } from '../middleware/error';
import { startMetricsServer } from '../metrics';
import { NODE_ENV } from '../environment';
import {
  PUBLIC_API_PORT,
  PUBLIC_API_RATE_LIMIT_WINDOW,
  PUBLIC_API_RATE_LIMIT_MAX_REQUESTS,
} from '../constants';
import rateLimit from 'express-rate-limit';
import { v1Router } from './v1';
import { context } from '../context';
import { loggingAndTimingMiddleware } from '../middleware/loggingAndTiming';

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

  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(loggingAndTimingMiddleware);

  const apiLimiter = rateLimit({
    windowMs: PUBLIC_API_RATE_LIMIT_WINDOW,
    max: PUBLIC_API_RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(apiLimiter);

  app.get('/', (req, res) => {
    res.send('GitPOAP Public API Server');
  });

  app.use('/v1', v1Router);

  app.use(errorHandler);

  app.listen(PUBLIC_API_PORT, () => {
    logger.info(`The application is listening on port ${PUBLIC_API_PORT}`);

    logger.debug(`Environment: ${NODE_ENV}`);
  });

  startMetricsServer();
};

void main();
