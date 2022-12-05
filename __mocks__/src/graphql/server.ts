import { sign } from 'jsonwebtoken';
import { FRONTEND_JWT_SECRET } from '../../../src/environment';
import { GQLAccessTokens } from '../../../src/graphql/accessTokens';
import { GraphQLClient } from 'graphql-request';

function genFrontendToken() {
  return sign({}, FRONTEND_JWT_SECRET);
}

export function genGQLAccessTokens(): GQLAccessTokens {
  return {
    frontend: genFrontendToken(),
    user: null,
  };
}

export function getGraphQLClient() {
  return new GraphQLClient('http://server:3001/graphql', {
    headers: {
      authorization: JSON.stringify(genGQLAccessTokens()),
    },
  });
}
