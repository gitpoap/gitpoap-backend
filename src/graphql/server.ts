import { createHandler } from 'graphql-http/lib/use/express';
import { createAndEmitSchema } from './schema';
import { context } from '../context';
import { createScopedLogger } from '../logging';
import { verify } from 'jsonwebtoken';
import { GRAPHIQL_PASSWORD, JWT_SECRET } from '../environment';
import { AccessTokenPayload, getAccessTokenPayload } from '../types/authTokens';
import { RequestHandler, Router } from 'express';
import { renderGraphiQL } from './graphiql';
import basicAuth from 'express-basic-auth';
import { InvalidAuthError, MissingAuthError } from './errors';

function parseGQLAuthorization(value: string): string | null {
  const logger = createScopedLogger('parseGQLAuthorization');

  const parts = value.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.warn('GQL access token is invalid');
    throw InvalidAuthError;
  }

  return parts[1] === 'null' ? null : parts[1];
}

export async function setupGQLContext(req: any) {
  const logger = createScopedLogger('setupGQLContext');

  const authorization = req.headers['authorization'];
  if (authorization === undefined) {
    logger.warn('User attempted to hit GQL endpoints without authorization');
    throw MissingAuthError;
  }

  // Parse the GQL access token
  const userAccessToken = parseGQLAuthorization(authorization);

  // Set the user token if it exists
  let userAccessTokenPayload: AccessTokenPayload | null = null;
  if (userAccessToken !== null) {
    try {
      userAccessTokenPayload = getAccessTokenPayload(verify(userAccessToken, JWT_SECRET));
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
