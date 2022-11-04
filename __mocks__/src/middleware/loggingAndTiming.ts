import { mockedLogger } from '../logging';
import { RequestHandler } from 'express';
import set from 'lodash/set';

export const loggingAndTimingMiddlewareMock: RequestHandler = (req, res, next) => {
  set(req, 'logger', mockedLogger);

  next();
};
