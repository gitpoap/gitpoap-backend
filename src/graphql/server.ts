import { graphqlHTTP } from 'express-graphql';
import { createAndEmitSchema } from './schema';
import { context } from '../context';
import { getGQLAccessToken } from './accessTokens';
import set from 'lodash/set';
import { createScopedLogger } from '../logging';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '../environment';
import { AccessTokenPayload, getAccessTokenPayload } from '../types/authTokens';
import { RequestHandler } from 'express';
import { getValidatedAccessTokenPayload } from '../lib/authTokens';

export async function createGQLServer(): Promise<RequestHandler> {
  const gqlSchema = await createAndEmitSchema();
  const gqlHandler = graphqlHTTP((req: any) => ({
    schema: gqlSchema,
    context: {
      ...context,
      userAccessTokenPayload: req.user !== null ? getAccessTokenPayload(req.user) : null,
    },
    graphiql: true,
  }));

  return async (req, res) => {
    const logger = createScopedLogger('gqlServerHandler');

    // Allow graphiql without auth
    if (req.method === 'GET' && req.path === '/') {
      gqlHandler(req, res);
      return;
    }

    const authorization = req.get('authorization');
    if (authorization === undefined) {
      logger.warn('User attempted to hit GQL endpoints without authorization');
      return res.status(401).send({ msg: 'No authorization provided' });
    }

    // Parse the GQL access token
    let gqlAccessToken;
    try {
      gqlAccessToken = getGQLAccessToken(JSON.parse(authorization));
    } catch (err) {
      logger.warn(`GQL access token is invalid: ${err}`);
      return res.status(401).send({ msg: 'GQL access token is invalid' });
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

    set(req, 'user', userAccessTokenPayload);

    gqlHandler(req, res);
  };
}
