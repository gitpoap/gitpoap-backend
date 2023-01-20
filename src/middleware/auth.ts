import jwt from 'express-jwt';
import set from 'lodash/set';
import {
  AccessTokenPayload,
  getAccessTokenPayload,
  getAccessTokenPayloadWithAddress,
  getAccessTokenPayloadWithGithubOAuth,
} from '../types/authTokens';
import { RequestHandler } from 'express';
import { JWT_SECRET } from '../environment';
import { createScopedLogger } from '../logging';
import { GITPOAP_BOT_APP_ID } from '../constants';
import { getGithubAuthenticatedApp } from '../external/github';
import { captureException } from '../lib/sentry';
import { isAddressAStaffMember, isGithubIdAStaffMember } from '../lib/staff';
import { removeGithubUsersLogin } from '../lib/githubUsers';
import { context } from '../context';

export const jwtBasic = jwt({ secret: JWT_SECRET as string, algorithms: ['HS256'] });

function safelyGetAccessTokenPayload(payload: any): AccessTokenPayload | null {
  const logger = createScopedLogger('safelyGetAccessTokenPayload');

  try {
    return getAccessTokenPayload(payload);
  } catch (err) {
    logger.warn(`Got a malformed AuthToken in middleware: ${err}`);

    return null;
  }
}

export function jwtAccessToken() {
  const jwtMiddleware = jwtBasic;

  const middleware: RequestHandler = async (req, res, next) => {
    const callback = async (err?: any) => {
      // If the previous middleware failed, pass on the error
      if (err) {
        next(err);
        return;
      }

      if (!req.user) {
        next({ status: 400, msg: 'Invalid or missing Access Token' });
        return;
      }

      const accessTokenPayload = safelyGetAccessTokenPayload(req.user);
      if (accessTokenPayload === null) {
        next({ status: 400, msg: 'Malformed Access Token' });
        return;
      }

      next();
    };

    jwtMiddleware(req, res, callback);
  };

  return middleware;
}

export function jwtWithAddress() {
  const jwtMiddleware = jwtAccessToken();

  const middleware: RequestHandler = async (req, res, next) => {
    const callback = async (err?: any) => {
      // If the previous middleware failed, pass on the error
      if (err) {
        next(err);
        return;
      }

      const accessTokenPayload = getAccessTokenPayload(req.user);
      if (accessTokenPayload.address === null) {
        next({ status: 401, msg: 'Not logged in with address' });
        return;
      }

      next();
    };

    jwtMiddleware(req, res, callback);
  };

  return middleware;
}

export function jwtWithStaffAddress() {
  const logger = createScopedLogger('jwtWithStaffAddress');

  const jwtMiddleware = jwtWithAddress();

  const middleware: RequestHandler = async (req, res, next) => {
    const callback = (err?: any) => {
      // If the previous middleware failed, pass on the error
      if (err) {
        next(err);
        return;
      }

      const { address } = getAccessTokenPayloadWithAddress(req.user);

      if (!isAddressAStaffMember(address.ethAddress)) {
        logger.warn(
          `Non-staff user (Address: ${address.ethAddress}) attempted to use staff-only routes`,
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

export function jwtWithGithubOAuth() {
  const logger = createScopedLogger('jwtWithGithubOAuth');

  const jwtMiddleware = jwtAccessToken();

  const middleware: RequestHandler = async (req, res, next) => {
    const callback = async (err?: any) => {
      // If the previous middleware failed, pass on the error
      if (err) {
        next(err);
        return;
      }

      const accessTokenPayload = getAccessTokenPayload(req.user);
      if (accessTokenPayload.github === null) {
        next({ status: 401, msg: 'Not logged in with github' });
        return;
      }

      const githubUser = await context.prisma.githubUser.findUnique({
        where: { id: accessTokenPayload.github.id },
        select: { githubOAuthToken: true },
      });
      if (githubUser === null) {
        next({ status: 401, msg: 'Not logged into GitHub' });
        return;
      }
      if (githubUser.githubOAuthToken === null) {
        logger.error(
          `GithubUser ID ${accessTokenPayload.github.id} has privyUserId set but not githubOAuthToken`,
        );
        await removeGithubUsersLogin(accessTokenPayload.github.id);
        next({ status: 401, msg: 'Not logged into GitHub' });
        return;
      }

      set(req, 'user.github.githubOAuthToken', githubUser.githubOAuthToken);

      next();
    };

    jwtMiddleware(req, res, callback);
  };

  return middleware;
}

export function jwtWithStaffOAuth() {
  const logger = createScopedLogger('jwtWithStaffOAuth');

  const jwtMiddleware = jwtWithGithubOAuth();

  const middleware: RequestHandler = (req, res, next) => {
    const callback = (err?: any) => {
      // If the previous middleware failed, pass on the error
      if (err) {
        next(err);
        return;
      }

      const { github } = getAccessTokenPayloadWithGithubOAuth(req.user);

      if (!isGithubIdAStaffMember(github.githubId)) {
        logger.warn(
          `Non-staff user (GitHub handle: ${github.githubHandle}) attempted to use staff-only routes`,
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

    if (typeof token !== 'string') {
      const msg = `gitpoap-bot endpoint hit with invalid credentials. The token is not a string: ${token}`;
      logger.warn(msg);
      captureException(new Error(msg), { service: 'middleware', function: 'gitpoapBotAuth' });
      next({ status: 400, msg: `Invalid credentials, token: ${token}` });
      return;
    }

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
