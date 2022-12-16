import { gql } from 'graphql-request';
import { GraphQLClient } from 'graphql-request';

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

  it('Accepts requests with user=null', async () => {
    const client = new GraphQLClient('http://server:3001/graphql', {
      headers: { authorization: 'Bearer null' },
    });

    return expect(
      client.request(
        gql`
          {
            totalClaims
          }
        `,
      ),
    ).resolves.toEqual({
      totalClaims: 16,
    });
  });

  it('Accepts requests with malformed user token', async () => {
    const client = new GraphQLClient('http://server:3001/graphql', {
      headers: { authorization: 'Bearer lkjalskdjflkajsldkfj' },
    });

    return expect(
      client.request(
        gql`
          {
            totalClaims
          }
        `,
      ),
    ).resolves.toEqual({
      totalClaims: 16,
    });
  });
});
