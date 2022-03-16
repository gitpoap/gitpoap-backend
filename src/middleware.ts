import jwt from 'express-jwt';
import { context } from './context';
import set from 'lodash/set';
import { AccessTokenPayload } from './types/tokens';
import { ErrorRequestHandler, RequestHandler } from 'express';
import { JWT_SECRET } from './environment';
import { createScopedLogger } from './logging';

export function jwtWithOAuth() {
  const jwtMiddleware = jwt({ secret: JWT_SECRET as string, algorithms: ['HS256'] });

  const middleware: RequestHandler = async (req, res, next) => {
    const callback = async () => {
      if (!req.user) {
        next({ status: 400, msg: 'Invalid or missing Access Token' });
        return;
      }
      const userInfo = await context.prisma.authToken.findUnique({
        where: {
          id: (<AccessTokenPayload>req.user).authTokenId,
        },
        select: {
          githubOAuthToken: true,
        },
      });
      if (userInfo === null) {
        next({ status: 500, msg: "Couldn't find your login" });
        return;
      }

      set(req, 'user.githubOAuthToken', userInfo.githubOAuthToken);

      next();
    };

    jwtMiddleware(req, res, callback);
  };

  return middleware;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const logger = createScopedLogger('errorHandler');

  if ('status' in err) {
    logger.warn(`Returning error status ${err.status} to user: ${err.msg}`);
    res.status(err.status).send(err.msg);
  } else {
    logger.error(`Caught unkown error: ${err}`);
    res.status(500).send(err.message);
  }
};
