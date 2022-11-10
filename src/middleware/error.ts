import { ErrorRequestHandler } from 'express';
import { createScopedLogger } from '../logging';
import { captureException } from '../lib/sentry';

export const errorHandler: ErrorRequestHandler = (err, req, res) => {
  const logger = createScopedLogger('errorHandler');

  if ('status' in err) {
    logger.warn(`Returning error status ${err.status} to user: ${err.msg}`);
    res.status(err.status).send(err.msg);
  } else {
    logger.error(`Caught unknown error: ${JSON.stringify(err)}`);
    captureException(err, { service: 'unknownException', function: 'errorHandler' });
    // Don't send users the actual error!
    res.status(500).send('An error occured on the server');
  }
};
