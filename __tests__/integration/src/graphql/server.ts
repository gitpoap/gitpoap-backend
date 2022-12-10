import { gql } from 'graphql-request';
import { GraphQLClient } from 'graphql-request';
import { sign } from 'jsonwebtoken';

describe('GraphQL Server', () => {
  it('Prevents requests without authentication', async () => {
    const client = new GraphQLClient('http://server:3001/graphql');

    return expect(
      client.request(
        gql`
          {
            totalClaims
          }
        `,
      ),
    ).rejects.toThrow();
  });

  it('Prevents requests from non-FE sources', async () => {
    const client = new GraphQLClient('http://server:3001/graphql', {
      headers: {
        authorization: JSON.stringify({
          frontend: sign({}, 'not-the-real-jwt-secret'),
          user: null,
        }),
      },
    });

    return expect(
      client.request(
        gql`
          {
            totalClaims
          }
        `,
      ),
    ).rejects.toThrow();
  });
});
