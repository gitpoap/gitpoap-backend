import 'reflect-metadata';
import express from 'express';
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

export async function setupApp() {
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
  app.use('/vitals', vitalsRouter);

  app.use(errorHandler);

  return app;
}
