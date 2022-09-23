import { GraphQLClient, gql } from 'graphql-request';
import { ADDRESSES, GH_HANDLES } from '../../../../../prisma/constants';

describe('CustomSearchResolver', () => {
  const client = new GraphQLClient('http://server:3001/graphql');

  it('search - usersByGithubHandle', async () => {
    const data = await client.request(gql`
      {
        search(text: "${GH_HANDLES.aldo}") {
          usersByGithubHandle {
            id
          }
        }
      }
    `);

    expect(data.search.usersByGithubHandle.length).toEqual(1);
    expect(data.search.usersByGithubHandle[0].id).toEqual(5);
  });

  it('search - profilesByName', async () => {
    const data = await client.request(gql`
      {
        search(text: "PB") {
          profilesByName {
            id
          }
        }
      }
    `);

    expect(data.search.profilesByName.length).toEqual(1);
    expect(data.search.profilesByName[0].id).toEqual(3);
  });

  it('search - profilesByAddress', async () => {
    const data = await client.request(gql`
      {
        search(text: "${ADDRESSES.colfax}") {
          profilesByAddress {
            id
          }
        }
      }
    `);

    expect(data.search.profilesByAddress.length).toEqual(1);
    expect(data.search.profilesByAddress[0].id).toEqual(1);
  });

  it('search - profilesByENS', async () => {
    const data = await client.request(gql`
      {
        search(text: "burz") {
          profilesByENS {
            id
          }
        }
      }
    `);

    expect(data.search.profilesByENS).not.toEqual(null);
    expect(data.search.profilesByENS.length).toEqual(1);
    expect(data.search.profilesByENS[0].id).toEqual(4);
  });
});
