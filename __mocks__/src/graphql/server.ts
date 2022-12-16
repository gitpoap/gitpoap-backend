import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '../../../src/environment';
import { GQLAccessToken } from '../../../src/graphql/accessTokens';
import { GraphQLClient } from 'graphql-request';

export function genGQLAccessTokens(userPayload?: Record<string, any>): GQLAccessToken {
  let user: string | null = null;
  if (userPayload !== undefined) {
    user = sign(userPayload, JWT_SECRET);
  }

  return { user };
}

export function getGraphQLClient(userPayload?: Record<string, any>) {
  return new GraphQLClient('http://server:3001/graphql', {
    headers: {
      authorization: JSON.stringify(genGQLAccessTokens(userPayload)),
    },
  });
}
