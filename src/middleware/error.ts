import { ErrorRequestHandler } from 'express';
import { createScopedLogger } from '../logging';
import { captureException } from '../lib/sentry';

// Based on https://stackoverflow.com/a/69881039/18750275
function circularReplacer() {
  const objectsAlreadyVisited = new WeakSet();

  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (objectsAlreadyVisited.has(value)) {
        return '[Circular]';
      }
      objectsAlreadyVisited.add(value);
    }

    return value;
  };
}

export const errorHandler: ErrorRequestHandler = (err, req, res) => {
  const logger = createScopedLogger('errorHandler');

  if ('status' in err) {
    logger.warn(`Returning error status ${err.status} to user: ${err.msg}`);
    res.status(err.status).send(err.msg);
  } else {
    logger.error(`Caught unknown error: ${JSON.stringify(err, circularReplacer())}`);
    captureException(err, { service: 'unknownException', function: 'errorHandler' });
    // Don't send users the actual error!
    res.status(500).send('An error occurred on the server');
  }
};
