import { sign } from 'jsonwebtoken';
import { FRONTEND_JWT_SECRET, JWT_SECRET } from '../../../src/environment';
import { GQLAccessTokens } from '../../../src/graphql/accessTokens';
import { GraphQLClient } from 'graphql-request';

function genFrontendToken() {
  return sign({}, FRONTEND_JWT_SECRET);
}

export function genGQLAccessTokens(userPayload?: Record<string, any>): GQLAccessTokens {
  let user: string | null = null;
  if (userPayload !== undefined) {
    user = sign(userPayload, JWT_SECRET);
  }

  return { frontend: genFrontendToken(), user };
}

export function getGraphQLClient(userPayload?: Record<string, any>) {
  return new GraphQLClient('http://server:3001/graphql', {
    headers: {
      authorization: JSON.stringify(genGQLAccessTokens(userPayload)),
    },
  });
}
