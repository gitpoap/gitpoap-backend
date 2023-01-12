import jwt from 'express-jwt';
import set from 'lodash/set';
import { getAccessTokenPayload, getAccessTokenPayloadWithGithubOAuth } from '../types/authTokens';
import { RequestHandler } from 'express';
import { JWT_SECRET } from '../environment';
import { createScopedLogger } from '../logging';
import { GITPOAP_BOT_APP_ID } from '../constants';
import { getGithubAuthenticatedApp } from '../external/github';
import { captureException } from '../lib/sentry';
import { isAddressAStaffMember } from '../lib/staff';
import { getValidatedAccessTokenPayload } from '../lib/authTokens';

export const jwtMiddleware = jwt({ secret: JWT_SECRET as string, algorithms: ['HS256'] });

function safelyGetAddressId(payload: any): number | null {
  const logger = createScopedLogger('safelyGetAddressId');

  try {
    const { addressId } = getAccessTokenPayload(payload);

    return addressId;
  } catch (err) {
    logger.warn(`Got a malformed AuthToken in middleware: ${err}`);

    return null;
  }
}

export function jwtWithAddress() {
  const middleware: RequestHandler = async (req, res, next) => {
    const callback = async () => {
      if (!req.user) {
        next({ status: 400, msg: 'Invalid or missing Access Token' });
        return;
      }

      const addressId = safelyGetAddressId(req.user);
      if (addressId === null) {
        next({ status: 400, msg: 'Malformed Access Token' });
        return;
      }

      const validatedAccessTokenPayload = await getValidatedAccessTokenPayload(addressId);
      if (validatedAccessTokenPayload === null) {
        next({ status: 401, msg: 'Not logged in with address' });
        return;
      }

      // Update the nullable fields in case they've updated in the DB
      set(req, 'user.ensName', validatedAccessTokenPayload.ensName);
      set(req, 'user.ensAvatarImageUrl', validatedAccessTokenPayload.ensAvatarImageUrl);
      set(req, 'user.memberships', validatedAccessTokenPayload.memberships);
      set(req, 'user.githubId', validatedAccessTokenPayload.githubId);
      set(req, 'user.githubHandle', validatedAccessTokenPayload.githubHandle);

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

      const { ethAddress } = getAccessTokenPayload(req.user);

      if (!isAddressAStaffMember(ethAddress)) {
        logger.warn(`Non-staff user (Address: ${ethAddress}) attempted to use staff-only routes`);
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

      const addressId = safelyGetAddressId(req.user);
      if (addressId === null) {
        next({ status: 400, msg: 'Malformed Access Token' });
        return;
      }

      const validatedAccessTokenPayload = await getValidatedAccessTokenPayload(addressId);
      if (validatedAccessTokenPayload === null) {
        next({ status: 401, msg: 'Not logged in with address' });
        return;
      }
      if (validatedAccessTokenPayload.githubOAuthToken === null) {
        next({ status: 401, msg: 'Not logged into GitHub' });
        return;
      }

      set(req, 'user.githubId', validatedAccessTokenPayload.githubId);
      set(req, 'user.githubHandle', validatedAccessTokenPayload.githubHandle);
      set(req, 'user.githubOAuthToken', validatedAccessTokenPayload.githubOAuthToken);

      // Update the nullable values in case they've updated in the DB
      set(req, 'user.ensName', validatedAccessTokenPayload.ensName);
      set(req, 'user.ensAvatarImageUrl', validatedAccessTokenPayload.ensAvatarImageUrl);
      set(req, 'user.memberships', validatedAccessTokenPayload.memberships);

      next();
    };

    jwtMiddleware(req, res, callback);
  };

  return middleware;
}

export function jwtWithStaffOAuth() {
  const logger = createScopedLogger('jwtWithStaffOAuth');

  const jwtMiddleware = jwtWithGitHubOAuth();

  const middleware: RequestHandler = (req, res, next) => {
    const callback = (err?: any) => {
      // If the previous middleware failed, pass on the error
      if (err) {
        next(err);
        return;
      }

      const { ethAddress } = getAccessTokenPayloadWithGithubOAuth(req.user);

      if (!isAddressAStaffMember(ethAddress)) {
        logger.warn(`Non-staff user (Address: ${ethAddress}) attempted to use staff-only routes`);
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
