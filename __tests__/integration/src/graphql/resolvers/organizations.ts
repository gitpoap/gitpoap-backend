import { gql } from 'graphql-request';
import { getGraphQLClient } from '../../../../../__mocks__/src/graphql/server';

describe('CustomOrganizationResolver', () => {
  const client = getGraphQLClient();

  it('organizationData - orgId', async () => {
    const data = await client.request(gql`
      {
        organizationData(orgId: 3) {
          id
          name
          contributorCount
          gitPOAPCount
          mintedGitPOAPCount
          repoCount
        }
      }
    `);

    expect(data.organizationData).not.toEqual(null);
    expect(data.organizationData.id).toEqual(3);
    expect(data.organizationData.name).toEqual('some-other-org');
    expect(data.organizationData.repoCount).toEqual(1);
    expect(data.organizationData.gitPOAPCount).toEqual(1);
    expect(data.organizationData.mintedGitPOAPCount).toEqual(2);
    expect(data.organizationData.contributorCount).toEqual(2);
  });

  it('organizationData - orgName', async () => {
    const data = await client.request(gql`
      {
        organizationData(orgName: "gitpoap") {
          id
          name
          contributorCount
          gitPOAPCount
          mintedGitPOAPCount
          repoCount
        }
      }
    `);

    expect(data.organizationData).not.toEqual(null);
    expect(data.organizationData.id).toEqual(4);
    expect(data.organizationData.name).toEqual('gitpoap');
    expect(data.organizationData.repoCount).toEqual(3);
    expect(data.organizationData.gitPOAPCount).toEqual(10);
    expect(data.organizationData.mintedGitPOAPCount).toEqual(10);
    expect(data.organizationData.contributorCount).toEqual(6);
  });

  it('allOrganizations - alphabetical', async () => {
    const data = await client.request(gql`
      {
        allOrganizations(perPage: 1, page: 1) {
          name
          repos {
            name
          }
        }
      }
    `);

    expect(data.allOrganizations).toHaveLength(1);
    expect(data.allOrganizations[0].name).toEqual('burz');
    expect(data.allOrganizations[0].repos).toHaveLength(1);
    expect(data.allOrganizations[0].repos[0].name).toEqual('dopex');
  });

  it('allOrganizations - date', async () => {
    const data = await client.request(gql`
      {
        allOrganizations(sort: "date", perPage: 1, page: 1) {
          name
          repos {
            name
          }
        }
      }
    `);

    expect(data.allOrganizations).toHaveLength(1);
    expect(data.allOrganizations[0].name).toEqual('stake-house');
    expect(data.allOrganizations[0].repos).toHaveLength(1);
    expect(data.allOrganizations[0].repos[0].name).toEqual('wagyu-installer');
  });

  const expectGitPOAPBackendProject = (data: Record<string, any>) => {
    expect(data.organizationRepos).toHaveLength(1);
    expect(data.organizationRepos[0].name).toEqual('gitpoap-backend');
    expect(data.organizationRepos[0].mintedGitPOAPCount).toEqual(7);
    expect(data.organizationRepos[0].contributorCount).toEqual(4);
  };

  it('organizationRepos - alphabetical', async () => {
    const data = await client.request(gql`
      {
        organizationRepos(orgId: 4, perPage: 1, page: 1) {
          name
          mintedGitPOAPCount
          contributorCount
        }
      }
    `);

    expectGitPOAPBackendProject(data);
  });

  it('organizationRepos - date', async () => {
    const data = await client.request(gql`
      {
        organizationRepos(orgId: 4, sort: "date", perPage: 1, page: 1) {
          name
          mintedGitPOAPCount
          contributorCount
        }
      }
    `);

    expect(data.organizationRepos).toHaveLength(1);
    expect(data.organizationRepos[0].name).toEqual('gitpoap-bot-test-repo2');
    expect(data.organizationRepos[0].mintedGitPOAPCount).toEqual(2);
    expect(data.organizationRepos[0].contributorCount).toEqual(2);
  });

  it('organizationRepos - contributor-count', async () => {
    const data = await client.request(gql`
      {
        organizationRepos(orgId: 4, sort: "contributor-count", perPage: 1, page: 1) {
          name
          mintedGitPOAPCount
          contributorCount
        }
      }
    `);

    expectGitPOAPBackendProject(data);
  });

  it('organizationRepos - minted-count', async () => {
    const data = await client.request(gql`
      {
        organizationRepos(orgId: 4, sort: "minted-count", perPage: 1, page: 1) {
          name
          mintedGitPOAPCount
          contributorCount
        }
      }
    `);

    expectGitPOAPBackendProject(data);
  });
});
