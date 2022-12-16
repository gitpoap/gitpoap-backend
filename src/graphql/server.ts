import { createHandler } from 'graphql-http/lib/use/express';
import { createAndEmitSchema } from './schema';
import { context } from '../context';
import { getGQLAccessToken } from './accessTokens';
import { createScopedLogger } from '../logging';
import { verify } from 'jsonwebtoken';
import { GRAPHIQL_PASSWORD, JWT_SECRET } from '../environment';
import { AccessTokenPayload, getAccessTokenPayload } from '../types/authTokens';
import { RequestHandler, Router } from 'express';
import { getValidatedAccessTokenPayload } from '../lib/authTokens';
import { renderGraphiQL } from './graphiql';
import basicAuth from 'express-basic-auth';
import { InvalidAuthError, MissingAuthError } from './errors';

export async function setupGQLContext(req: any) {
  const logger = createScopedLogger('setupGQLContext');

  const authorization = req.headers['authorization'];
  if (authorization === undefined) {
    logger.warn('User attempted to hit GQL endpoints without authorization');
    throw MissingAuthError;
  }

  // Parse the GQL access token
  let gqlAccessToken;
  try {
    gqlAccessToken = getGQLAccessToken(JSON.parse(authorization));
  } catch (err) {
    logger.warn(`GQL access token is invalid: ${err}`);
    throw InvalidAuthError;
  }

  // Set the user token if it exists
  let userAccessTokenPayload: AccessTokenPayload | null = null;
  if (gqlAccessToken.user !== null) {
    try {
      const basePayload = getAccessTokenPayload(verify(gqlAccessToken.user, JWT_SECRET));
      const validatedPayload = await getValidatedAccessTokenPayload(basePayload.authTokenId);
      if (validatedPayload !== null) {
        userAccessTokenPayload = { ...basePayload, ...validatedPayload };
      } else {
        logger.debug('User access token is no longer valid');
      }
    } catch (err) {
      logger.debug(`User access token is malformed: ${err}`);
    }
  }

  return {
    ...context,
    userAccessTokenPayload,
  };
}

async function createGQLServer(): Promise<RequestHandler> {
  const gqlSchema = await createAndEmitSchema();

  return createHandler({
    schema: gqlSchema,
    context: setupGQLContext,
  });
}

export async function createGQLRouter() {
  const gqlRouter = Router();

  gqlRouter.get(
    '/',
    basicAuth({
      users: { gitpoap: GRAPHIQL_PASSWORD },
      challenge: true,
    }),
    (req, res) => {
      return res.setHeader('Content-Type', 'text/html').send(renderGraphiQL());
    },
  );

  gqlRouter.use('/', await createGQLServer());

  return gqlRouter;
}
