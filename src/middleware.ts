import jwt from 'express-jwt';
import { context } from './context';
import set from 'lodash/set';
import { AccessTokenPayload } from './types/tokens';
import { ErrorRequestHandler, RequestHandler } from 'express';
import { JWT_SECRET } from './environment';
import { createScopedLogger } from './logging';
import { ADMIN_GITHUB_IDS, GITPOAP_BOT_APP_ID } from './constants';
import { getGithubAuthenticatedApp } from './external/github';

export function jwtWithOAuth() {
  const jwtMiddleware = jwt({ secret: JWT_SECRET as string, algorithms: ['HS256'] });

  const middleware: RequestHandler = async (req, res, next) => {
    const callback = async (err?: any) => {
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

export function jwtWithAdminOAuth() {
  const logger = createScopedLogger('jwtWithAdminOAuth');

  const jwtMiddleware = jwtWithOAuth();

  const middleware: RequestHandler = (req, res, next) => {
    const callback = (err?: any) => {
      // If the previous middleware failed, pass on the error
      if (err) {
        next(err);
        return;
      }

      const payload = <AccessTokenPayload>req.user;

      if (!ADMIN_GITHUB_IDS.includes(payload.githubId)) {
        logger.warn(
          `Non-admin user (GitHub handle: ${payload.githubHandle}) attempted to use admin-only routes`,
        );
        next({ status: 401, msg: 'You are not privileged for this endpoint' });
        return;
      }

      next();
    };

    jwtMiddleware(req, res, callback);
  };

  return middleware;
}

// Auth middleware for gitpoap-bot
export function gitpoapBotAuth() {
  const logger = createScopedLogger('gitpoapBotAuth');

  const middleware: RequestHandler = async (req, res, next) => {
    if (!req.headers.authorization) {
      logger.warn('Someone attempted to hit a gitpoap-bot route without credentials');
      next({ status: 400, msg: 'You are not privileged for this endpoint' });
      return;
    }

    const authParts = req.headers.authorization.split(' ');

    if (authParts.length !== 2 || authParts[0] !== 'Bearer') {
      logger.warn('gitpoap-bot route hit with invalid credentials');
      next({ status: 400, msg: 'Invalid credentials' });
      return;
    }

    const token = authParts[1];

    const githubApp = await getGithubAuthenticatedApp(token);
    if (githubApp === null) {
      logger.warn('gitpoap-bot route hit with invalid credentials');
      next({ status: 400, msg: 'Invalid credentials' });
      return;
    }

    if (githubApp.id !== GITPOAP_BOT_APP_ID) {
      logger.warn(`Unauthorized app id ${githubApp.id} attempted to access gitpoap-bot routes`);
      next({ status: 401, msg: 'You are not privileged for this endpoint' });
      return;
    }

    next();
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
