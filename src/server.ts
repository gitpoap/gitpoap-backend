require('dotenv').config();
import 'reflect-metadata';
import { CONTACTS_TABLE_NAME } from './external/dynamo';
import { PORT } from './constants';
import { context } from './context';
import { registerHandler } from 'segfault-handler';
import {
  NODE_ENV,
  JWT_SECRET,
  AWS_PROFILE,
  MAILCHIMP_API_KEY,
  SENTRY_DSN,
  POSTMARK_SERVER_TOKEN,
} from './environment';
import { createScopedLogger, updateLogLevel } from './logging';
import minimist from 'minimist';
import { startMetricsServer } from './metrics';
import { setupApp } from './app';
import { startBatchProcesses } from './batchProcessing';

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

  const app = await setupApp();

  app.listen(PORT, () => {
    logger.info(`The application is listening on port ${PORT}`);

    logger.debug(`Environment:       ${NODE_ENV}`);
    logger.debug(`Secret:            ${JWT_SECRET}`);
    logger.debug(`Contacts table:    ${CONTACTS_TABLE_NAME}`);
    logger.debug(`Using AWS Profile: ${AWS_PROFILE}`);
    logger.debug(`MailChimp API Key: ${MAILCHIMP_API_KEY}`);
    logger.debug(`Sentry DSN:        ${SENTRY_DSN}`);
    logger.debug(`Postmark API Key:  ${POSTMARK_SERVER_TOKEN}`);
  });

  startMetricsServer();

  startBatchProcesses();
};

main();
