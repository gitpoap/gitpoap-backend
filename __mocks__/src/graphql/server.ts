import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '../../../src/environment';
import { GraphQLClient } from 'graphql-request';

function genGQLAccessToken(userPayload?: Record<string, any>) {
  let user: string | null = null;
  if (userPayload !== undefined) {
    user = sign(userPayload, JWT_SECRET);
  }

  return `Bearer ${user}`;
}

export function getGraphQLClient(userPayload?: Record<string, any>) {
  return new GraphQLClient('http://server:3001/graphql', {
    headers: {
      authorization: genGQLAccessToken(userPayload),
    },
  });
}
