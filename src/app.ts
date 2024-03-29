import 'reflect-metadata';
import express, { Express, RequestHandler } from 'express';
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';
import cors from 'cors';
import { errorHandler } from './middleware/error';
import { subscribeRouter } from './routes/subscribe';
import { suggestRouter } from './routes/suggest';
import jwtRouter from './routes/jwt';
import { claimsRouter } from './routes/claims';
import { featuredRouter } from './routes/featured';
import { gitPOAPsRouter } from './routes/gitpoaps';
import { profilesRouter } from './routes/profiles';
import { projectsRouter } from './routes/projects';
import { triggersRouter } from './routes/triggers';
import { vitalsRouter } from './routes/vitals';
import { NODE_ENV, SENTRY_DSN } from './environment';
import { authRouter } from './routes/auth';
import { loggingAndTimingMiddleware } from './middleware/loggingAndTiming';
import { routeNotFoundHandler } from './middleware/routeNotFound';
import { createGQLRouter } from './graphql/server';
import { teamsRouter } from './routes/teams';

const initializeSentry = (app: Express) => {
  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: NODE_ENV,
      /* Only send errors to sentry if env is production */
      enabled: NODE_ENV === 'production',
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Tracing.Integrations.Express({ app }),
      ],
      tracesSampleRate: 0.2,
      attachStacktrace: true,
    });

    // RequestHandler creates a separate execution context using domains, so that every
    // transaction/span/breadcrumb is attached to its own Hub instance
    app.use(Sentry.Handlers.requestHandler());
    // TracingHandler creates a trace for every incoming request
    app.use(Sentry.Handlers.tracingHandler());
    app.use(Sentry.Handlers.errorHandler());
  }
};

export async function setupAppWithMiddleware(middleware: RequestHandler[]) {
  const app = express();
  initializeSentry(app);

  app.use(cors());
  app.use(express.json());

  app.use('/graphql', await createGQLRouter());

  for (const mw of middleware) {
    app.use(mw);
  }

  app.get('/', (req, res) => {
    res.send('GitPOAP API Server');
  });

  /* Endpoints */
  app.use('/auth', authRouter);
  app.use('/jwt', jwtRouter);
  app.use('/subscribe', subscribeRouter);
  app.use('/suggest', suggestRouter);

  /* API endpoints for the frontend */
  app.use('/claims', claimsRouter);
  app.use('/featured', featuredRouter);
  app.use('/gitpoaps', gitPOAPsRouter);
  app.use('/profiles', profilesRouter);
  app.use('/projects', projectsRouter);
  app.use('/triggers', triggersRouter);
  app.use('/teams', teamsRouter);
  app.use('/vitals', vitalsRouter);

  app.use(routeNotFoundHandler);

  app.use(errorHandler);

  return app;
}

export async function setupApp() {
  return await setupAppWithMiddleware([loggingAndTimingMiddleware]);
}
