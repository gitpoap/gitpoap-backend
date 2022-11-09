import { ErrorRequestHandler } from 'express';
import { createScopedLogger } from '../logging';

export const errorHandler: ErrorRequestHandler = (err, req, res) => {
  const logger = createScopedLogger('errorHandler');

  if ('status' in err) {
    logger.warn(`Returning error status ${err.status} to user: ${err.msg}`);
    res.status(err.status).send(err.msg);
  } else {
    logger.error(`Caught unknown error: ${JSON.stringify(err)}`);
    res.status(500).send(err.message);
  }
};
