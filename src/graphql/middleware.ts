import { MiddlewareFn } from 'type-graphql';
import { Logger } from '../types/logger';
import { createScopedLogger } from '../logging';
import { AuthContext } from './auth';
import { gqlRequestDurationSeconds } from '../metrics';
import set from 'lodash/set';

export type AuthLoggingContext = AuthContext & {
  logger: Logger;
};

export const loggingAndTimingMiddleware: MiddlewareFn<AuthLoggingContext> = async (
  { info, context },
  next,
) => {
  const requestName = `${info.parentType.name}.${info.fieldName}`;
  const logger = createScopedLogger(`GQL ${requestName}`);
  const endTimer = gqlRequestDurationSeconds.startTimer(requestName);

  set(context, 'logger', logger);

  logger.debug('Handling resolve request');

  try {
    const result = await next();

    if (result !== null) {
      endTimer({ success: 1 });
      logger.debug(`Completed without error`);
    } else {
      endTimer({ success: 0 });
      logger.debug(`Completed with null (error)`);
    }
  } catch (err) {
    endTimer({ success: 0 });
    logger.debug(`Completed with caught error: ${err}`);
    throw err;
  }
};
