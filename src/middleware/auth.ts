import jwt from 'express-jwt';
import { context } from '../context';
import set from 'lodash/set';
import { getAccessTokenPayload, getAccessTokenPayloadWithGithubOAuth } from '../types/authTokens';
import { RequestHandler } from 'express';
import { JWT_SECRET } from '../environment';
import { createScopedLogger } from '../logging';
import { GITPOAP_BOT_APP_ID } from '../constants';
import { getGithubAuthenticatedApp } from '../external/github';
import { captureException } from '../lib/sentry';
import { isAddressAnAdmin } from '../lib/admins';

export const jwtMiddleware = jwt({ secret: JWT_SECRET as string, algorithms: ['HS256'] });

export function jwtWithAddress() {
  const middleware: RequestHandler = async (req, res, next) => {
    const callback = async () => {
      if (!req.user) {
        next({ status: 400, msg: 'Invalid or missing Access Token' });
        return;
      }

      const { authTokenId } = getAccessTokenPayload(req.user);

      const tokenInfo = await context.prisma.authToken.findUnique({
        where: {
          id: authTokenId,
        },
        select: {
          id: true,
          address: {
            select: {
              ensName: true,
              ensAvatarImageUrl: true,
              githubUser: {
                select: {
                  githubId: true,
                  githubHandle: true,
                },
              },
              discordUser: {
                select: {
                  discordId: true,
                  discordHandle: true,
                },
              },
              email: {
                select: {
                  id: true,
                  isValidated: true,
                },
              },
            },
          },
        },
      });
      if (tokenInfo === null) {
        next({ status: 401, msg: 'Not logged in with address' });
        return;
      }

      let emailId: number | null = null;
      if (tokenInfo.address.email !== null) {
        emailId = tokenInfo.address.email.isValidated ? tokenInfo.address.email.id : null;
      }

      // Update the nullable fields in case they've updated in the DB
      set(req, 'user.ensName', tokenInfo.address.ensName);
      set(req, 'user.ensAvatarImageUrl', tokenInfo.address.ensAvatarImageUrl);
      set(req, 'user.githubId', tokenInfo.address.githubUser?.githubId ?? null);
      set(req, 'user.githubHandle', tokenInfo.address.githubUser?.githubHandle ?? null);
      set(req, 'user.discordId', tokenInfo.address.discordUser?.discordId ?? null);
      set(req, 'user.discordHandle', tokenInfo.address.discordUser?.discordHandle ?? null);
      set(req, 'user.emailId', emailId);

      next();
    };

    jwtMiddleware(req, res, callback);
  };

  return middleware;
}

export function jwtWithAdminAddress() {
  const logger = createScopedLogger('jwtWithAdminAddress');

  const jwtMiddleware = jwtWithAddress();

  const middleware: RequestHandler = async (req, res, next) => {
    const callback = (err?: any) => {
      // If the previous middleware failed, pass on the error
      if (err) {
        next(err);
        return;
      }

      const { address } = getAccessTokenPayload(req.user);

      if (!isAddressAnAdmin(address)) {
        logger.warn(`Non-admin user (Address: ${address}) attempted to use admin-only routes`);
        next({ status: 401, msg: 'You are not privileged for this endpoint' });
        return;
      }

      next();
    };

    jwtMiddleware(req, res, callback);
  };

  return middleware;
}

export function jwtWithGitHubOAuth() {
  const middleware: RequestHandler = async (req, res, next) => {
    const callback = async () => {
      if (!req.user) {
        next({ status: 400, msg: 'Invalid or missing Access Token' });
        return;
      }

      const tokenInfo = await context.prisma.authToken.findUnique({
        where: {
          id: getAccessTokenPayload(req.user).authTokenId,
        },
        select: {
          address: {
            select: {
              ensName: true,
              ensAvatarImageUrl: true,
              githubUser: {
                select: {
                  githubId: true,
                  githubHandle: true,
                  githubOAuthToken: true,
                },
              },
              discordUser: {
                select: {
                  discordId: true,
                  discordHandle: true,
                  discordOAuthToken: true,
                },
              },
              email: {
                select: {
                  id: true,
                  isValidated: true,
                },
              },
            },
          },
        },
      });
      if (tokenInfo === null) {
        next({ status: 401, msg: 'Not logged in with address' });
        return;
      }
      if (
        tokenInfo.address.githubUser === null ||
        tokenInfo.address.githubUser.githubOAuthToken === null
      ) {
        next({ status: 401, msg: 'Not logged into GitHub' });
        return;
      }

      set(req, 'user.githubId', tokenInfo.address.githubUser.githubId);
      set(req, 'user.githubHandle', tokenInfo.address.githubUser.githubHandle);
      set(req, 'user.githubOAuthToken', tokenInfo.address.githubUser.githubOAuthToken);

      set(req, 'user.discordId', tokenInfo.address.discordUser?.discordId ?? null);
      set(req, 'user.discordHandle', tokenInfo.address.discordUser?.discordHandle ?? null);

      let emailId: number | null = null;
      if (tokenInfo.address.email !== null) {
        emailId = tokenInfo.address.email.isValidated ? tokenInfo.address.email.id : null;
      }

      // Update the nullable values in case they've updated in the DB
      set(req, 'user.ensName', tokenInfo.address.ensName);
      set(req, 'user.ensAvatarImageUrl', tokenInfo.address.ensAvatarImageUrl);
      set(req, 'user.emailId', emailId);

      next();
    };

    jwtMiddleware(req, res, callback);
  };

  return middleware;
}

export function jwtWithAdminOAuth() {
  const logger = createScopedLogger('jwtWithAdminOAuth');

  const jwtMiddleware = jwtWithGitHubOAuth();

  const middleware: RequestHandler = (req, res, next) => {
    const callback = (err?: any) => {
      // If the previous middleware failed, pass on the error
      if (err) {
        next(err);
        return;
      }

      const { address, githubHandle } = getAccessTokenPayloadWithGithubOAuth(req.user);

      if (!isAddressAnAdmin(address)) {
        logger.warn(
          `Non-admin user (GitHub handle: ${githubHandle}) attempted to use admin-only routes`,
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
