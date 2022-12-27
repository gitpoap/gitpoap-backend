import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '../../../src/environment';
import { GraphQLClient } from 'graphql-request';

export function genGQLAccessToken(userPayload?: Record<string, any>) {
  let token: string | null = null;
  if (userPayload !== undefined) {
    token = sign(userPayload, JWT_SECRET);
  }

  return token;
}

export function genAuthHeader(userPayload?: Record<string, any>) {
  const token = genGQLAccessToken(userPayload);
  return `Bearer ${token}`;
}

export function getGraphQLClient(userPayload?: Record<string, any>) {
  return new GraphQLClient('http://server:3001/graphql', {
    headers: {
      authorization: genAuthHeader(userPayload),
    },
  });
}
