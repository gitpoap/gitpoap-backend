import express, { RequestHandler } from 'express';
import { PUBLIC_API_RATE_LIMIT_WINDOW, PUBLIC_API_RATE_LIMIT_MAX_REQUESTS } from '../constants';
import rateLimit from 'express-rate-limit';
import { loggingAndTimingMiddleware } from '../middleware/loggingAndTiming';
import { errorHandler } from '../middleware/error';
import cors from 'cors';
import { v1Router } from './v1';
import { routeNotFoundHandler } from '../middleware/routeNotFound';

export function setupAppWithMiddleware(middleware: RequestHandler[]) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  for (const mw of middleware) {
    app.use(mw);
  }

  app.get('/', (req, res) => {
    res.send('GitPOAP Public API Server');
  });

  app.use('/v1', v1Router);

  app.use(routeNotFoundHandler);
  app.use(errorHandler);

  return app;
}

export function setupApp() {
  const apiLimiter = rateLimit({
    windowMs: PUBLIC_API_RATE_LIMIT_WINDOW,
    max: PUBLIC_API_RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
  });

  return setupAppWithMiddleware([loggingAndTimingMiddleware, apiLimiter]);
}
