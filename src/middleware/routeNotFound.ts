import { RequestHandler } from 'express';
import { getRequestLogger } from './loggingAndTiming';

export const routeNotFoundHandler: RequestHandler = (req, res) => {
  // Note that the request logger already prints out the route
  getRequestLogger(req).error(`Unknown route called!`);

  return res.status(404).send({
    msg: `Route ${req.method} ${req.path} not found!`,
  });
};
