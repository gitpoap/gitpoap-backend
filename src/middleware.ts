import jwt from 'express-jwt';
import { context } from './context';
import set from 'lodash/set';
import { AccessTokenPayload } from './types';
import { RequestHandler } from 'express';

export function jwtWithOAuth() {
  const jwtMiddleware = jwt({ secret: process.env.JWT_SECRET as string, algorithms: ['HS256'] });

  const middleware: RequestHandler = async (req, res, next) => {
    const callback = async () => {
      if (!req.user) {
        throw Error('Invalid or missing Access Token');
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
        throw Error("Couldn't find your login");
      }

      set(req, 'user.githubOAuthToken', userInfo.githubOAuthToken);

      next();
    };

    jwtMiddleware(req, res, callback);
  };

  return middleware;
}
