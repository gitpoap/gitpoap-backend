import { RequestHandler } from 'express';
import { Logger, isLogger } from '../types/logger';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import set from 'lodash/set';

export const loggingAndTimingMiddleware: RequestHandler = (req, res, next) => {
  const logger = createScopedLogger(`${req.method} ${req.path}`);
  const endTimer = httpRequestDurationSeconds.startTimer(req.method, req.path);

  logger.debug(`Handling Body: ${JSON.stringify(req.body)}, Params: ${JSON.stringify(req.params)}`);

  const originalEnd = res.end;

  // Override the end function
  res.end = (chunk: any, encoding?: any) => {
    logger.debug(`Completed request with status: ${res.statusCode}`);

    endTimer({ status: res.statusCode });

    res.end = originalEnd;
    res.end(chunk, encoding);
  };

  // Set the logger on the request
  set(req, 'logger', logger);

  next();
};

export function getRequestLogger(req: any): Logger {
  if (isLogger(req.logger)) {
    return req.logger;
  }

  throw Error(`The logger is not setup on ${req.method} ${req.path}`);
}
