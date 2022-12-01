import { graphqlHTTP } from 'express-graphql';
import { createAndEmitSchema } from './schema';
import { context } from '../context';
import { IS_PROD } from '../constants';
import { getGQLAccessTokens } from './accessTokens';
import set from 'lodash/set';
import { createScopedLogger } from '../logging';
import { verify } from 'jsonwebtoken';
import { FRONTEND_JWT_SECRET, JWT_SECRET } from '../environment';
import { AccessTokenPayload, getAccessTokenPayload } from '../types/authTokens';
import { Request, RequestHandler } from 'express';

export async function createGQLServer(): Promise<RequestHandler> {
  const gqlHandler = graphqlHTTP({
    schema: await createAndEmitSchema(),
    context: (req: Request) => ({
      ...context,
      userAccessTokenPayload: req.user !== null ? getAccessTokenPayload(req.user) : null,
    }),
    // Allow graphiql outside of PROD
    graphiql: !IS_PROD,
  });

  return (req, res) => {
    const logger = createScopedLogger('gqlServerHandler');

    // Allow graphiql outside of PROD
    if (!IS_PROD && req.method === 'GET' && req.path === '/') {
      return gqlHandler(req, res);
    }

    const authorization = req.get('authorization');
    if (authorization === undefined) {
      logger.warn('User attempted to hit GQL endpoints without authorization');
      return res.status(401).send({ msg: 'No authorization provided' });
    }

    // Authenticate the frontend token
    let gqlAccessTokens;
    try {
      gqlAccessTokens = getGQLAccessTokens(JSON.parse(authorization));

      verify(gqlAccessTokens.frontend, FRONTEND_JWT_SECRET);
    } catch (err) {
      logger.warn(`Frontend authentication token is invalid: ${err}`);
      return res.status(401).send({ msg: 'Frontend token is invalid' });
    }

    // Set the user token if it exists
    let userAccessTokenPayload: AccessTokenPayload | null = null;
    if (gqlAccessTokens.user !== null) {
      try {
        userAccessTokenPayload = getAccessTokenPayload(verify(gqlAccessTokens.user, JWT_SECRET));
      } catch (err) {
        logger.debug(`User access token is invalid: ${err}`);
      }
    }

    set(req, 'user', userAccessTokenPayload);

    gqlHandler(req, res);
  };
}
