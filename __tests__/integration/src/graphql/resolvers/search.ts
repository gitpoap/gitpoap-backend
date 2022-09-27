import { GraphQLClient, gql } from 'graphql-request';
import { ADDRESSES, GH_HANDLES } from '../../../../../prisma/constants';

describe('CustomSearchResolver', () => {
  const client = new GraphQLClient('http://server:3001/graphql');

  it('search - users', async () => {
    const data = await client.request(gql`
      {
        search(text: "${GH_HANDLES.aldo}") {
          users {
            id
          }
        }
      }
    `);

    expect(data.search.users.length).toEqual(1);
    expect(data.search.users[0].id).toEqual(5);
  });

  it('search - profiles by name', async () => {
    const data = await client.request(gql`
      {
        search(text: "PB") {
          profiles {
            id
          }
        }
      }
    `);

    expect(data.search.profiles.length).toEqual(1);
    expect(data.search.profiles[0].id).toEqual(3);
  });

  it('search - profiles by address', async () => {
    const data = await client.request(gql`
      {
        search(text: "${ADDRESSES.colfax}") {
          profiles {
            id
          }
        }
      }
    `);

    expect(data.search.profiles.length).toEqual(1);
    expect(data.search.profiles[0].id).toEqual(1);
  });

  it('search - profiles by ENS', async () => {
    const data = await client.request(gql`
      {
        search(text: "burz.e") {
          profiles {
            id
          }
        }
      }
    `);

    expect(data.search.profiles.length).toEqual(1);
    expect(data.search.profiles[0].id).toEqual(4);
  });
});
