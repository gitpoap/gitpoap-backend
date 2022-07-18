import 'reflect-metadata';
import express, { Express } from 'express';
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';
import { graphqlHTTP } from 'express-graphql';
import { createAndEmitSchema } from './graphql/schema';
import { context } from './context';
import cors from 'cors';
import { errorHandler } from './middleware';
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
import { vitalsRouter } from './routes/vitals';
import { NODE_ENV, SENTRY_DSN } from './environment';

const initializeSentry = (app: Express) => {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: NODE_ENV,
    /* Only send errors to sentry if env is production */
    enabled: NODE_ENV === 'production',
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Tracing.Integrations.Express({ app }),
    ],
    tracesSampleRate: 1.0,
  });

  // RequestHandler creates a separate execution context using domains, so that every
  // transaction/span/breadcrumb is attached to its own Hub instance
  app.use(Sentry.Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
};

export async function setupApp() {
  const app = express();
  initializeSentry(app);

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
  app.use('/vitals', vitalsRouter);

  /* Initialize Error Handlers */
  app.use(Sentry.Handlers.errorHandler());
  app.use(errorHandler);

  return app;
}
