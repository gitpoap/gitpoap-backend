require('dotenv').config();

import express from 'express';
import 'reflect-metadata';
import cors from 'cors';
import { subscribeRouter } from './routes/subscribe';
import { suggestRouter } from './routes/suggest';
import jwtRouter from './routes/jwt';
import { claimsRouter } from './routes/claims';
import { featuredRouter } from './routes/featured';
import { githubRouter } from './routes/github';
import { gitpoapsRouter } from './routes/gitpoaps';
import { profilesRouter } from './routes/profiles';
import { projectsRouter } from './routes/projects';
import { organizationsRouter } from './routes/organizations';
import { triggersRouter } from './routes/triggers';
import { CONTACTS_TABLE_NAME } from './dynamo';
import {
  MILLISECONDS_PER_MINUTE,
  ONGOING_ISSUANCE_CHECK_FREQUENCY_MINUTES,
  PORT,
} from './constants';
import { createAndEmitSchema } from './graphql/schema';
import { context } from './context';
import { graphqlHTTP } from 'express-graphql';
import { registerHandler } from 'segfault-handler';
import { errorHandler } from './middleware';
import { NODE_ENV, JWT_SECRET, AWS_PROFILE } from './environment';
import { createScopedLogger, updateLogLevel } from './logging';
import minimist from 'minimist';
import { startMetricsServer } from './metrics';
import { tryToRunOngoingIssuanceUpdater } from './lib/ongoing';

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

  app.get('/', (req, res) => {
    res.send('GitPOAP API Server');
  });

  /* Endpoints */
  app.use('/jwt', jwtRouter);
  app.use('/subscribe', subscribeRouter);
  app.use('/suggest', suggestRouter);
  app.use('/github', githubRouter);
  app.use(
    '/graphql',
    graphqlHTTP({ schema: await createAndEmitSchema(), context, graphiql: true }),
  );

  /* API endpoints for the frontend */
  app.use('/claims', claimsRouter);
  app.use('/featured', featuredRouter);
  app.use('/gitpoaps', gitpoapsRouter);
  app.use('/profiles', profilesRouter);
  app.use('/projects', projectsRouter);
  app.use('/organizations', organizationsRouter);
  app.use('/triggers', triggersRouter);

  app.use(errorHandler);

  app.listen(PORT, () => {
    logger.info(`The application is listening on port ${PORT}`);

    logger.debug(`Environment:       ${NODE_ENV}`);
    logger.debug(`Secret:            ${JWT_SECRET}`);
    logger.debug(`Contacts table:    ${CONTACTS_TABLE_NAME}`);
    logger.debug(`Using AWS Profile: ${AWS_PROFILE}`);
  });

  startMetricsServer();

  // Set the ongoing issuance backend process to run
  await tryToRunOngoingIssuanceUpdater();
  setInterval(
    tryToRunOngoingIssuanceUpdater,
    ONGOING_ISSUANCE_CHECK_FREQUENCY_MINUTES * MILLISECONDS_PER_MINUTE,
  );
};

main();
