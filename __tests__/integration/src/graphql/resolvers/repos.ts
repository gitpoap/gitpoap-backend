import { GraphQLClient, gql } from 'graphql-request';

describe('CustomRepoResolver', () => {
  const client = new GraphQLClient('http://server:3001/graphql');

  it('repoData - repoId', async () => {
    const data = await client.request(gql`
      {
        repoData(repoId: 7) {
          name
          gitPOAPCount
          mintedGitPOAPCount
          contributorCount
        }
      }
    `);

    expect(data.repoData).not.toEqual(null);
    expect(data.repoData.name).toEqual('wagyu-installer');
    expect(data.repoData.gitPOAPCount).toEqual(3);
    expect(data.repoData.mintedGitPOAPCount).toEqual(0);
    expect(data.repoData.contributorCount).toEqual(0);
  });

  it('repoData - orgName+repoName', async () => {
    const data = await client.request(gql`
      {
        repoData(orgName: "gitpoap", repoName: "gitpoap-backend") {
          name
          gitPOAPCount
          mintedGitPOAPCount
          contributorCount
        }
      }
    `);

    expect(data.repoData).not.toEqual(null);
    expect(data.repoData.name).toEqual('gitpoap-backend');
    expect(data.repoData.gitPOAPCount).toEqual(4);
    expect(data.repoData.mintedGitPOAPCount).toEqual(7);
    expect(data.repoData.contributorCount).toEqual(4);
  });

  it('totalRepos', async () => {
    const data = await client.request(gql`
      {
        totalRepos
      }
    `);

    expect(data.totalRepos).toEqual(8);
  });

  it('recentlyAddedRepos', async () => {
    const data = await client.request(gql`
      {
        recentlyAddedRepos(count: 1) {
          name
        }
      }
    `);

    expect(data.recentlyAddedRepos).toHaveLength(1);
    expect(data.recentlyAddedRepos[0].name).toEqual('gitpoap-bot-test-repo2');
  });

  it('allRepos - alphabetical', async () => {
    const data = await client.request(gql`
      {
        allRepos(perPage: 1, page: 1) {
          name
        }
      }
    `);

    expect(data.allRepos).toHaveLength(1);
    expect(data.allRepos[0].name).toEqual('dopex');
  });

  it('allRepos - date', async () => {
    const data = await client.request(gql`
      {
        allRepos(sort: "date", perPage: 1, page: 1) {
          name
        }
      }
    `);

    expect(data.allRepos).toHaveLength(1);
    expect(data.allRepos[0].name).toEqual('gitpoap-bot-test-repo2');
  });

  it('allRepos - gitpoap-count', async () => {
    const data = await client.request(gql`
      {
        allRepos(sort: "gitpoap-count", perPage: 1, page: 1) {
          name
        }
      }
    `);

    expect(data.allRepos).toHaveLength(1);
    expect(data.allRepos[0].name).toEqual('gitpoap-backend');
  });

  it('trendingRepos - count', async () => {
    const data = await client.request(gql`
      {
        trendingRepos(count: 1, numDays: 10000) {
          name
          mintedGitPOAPCount
        }
      }
    `);

    expect(data.trendingRepos).toHaveLength(1);
    expect(data.trendingRepos[0].name).toEqual('gitpoap-backend');
    expect(data.trendingRepos[0].mintedGitPOAPCount).toEqual(3);
  });

  it('trendingRepos - orderby mintedGitPOAPCount', async () => {
    const data = await client.request(gql`
      {
        trendingRepos(count: 2, numDays: 10000) {
          name
          mintedGitPOAPCount
          contributorCount
          gitPOAPCount
        }
      }
    `);

    expect(data.trendingRepos).toHaveLength(2);
    expect(data.trendingRepos[0].name).toEqual('gitpoap-backend');
    expect(data.trendingRepos[0].mintedGitPOAPCount).toEqual(3);
    expect(data.trendingRepos[0].contributorCount).toEqual(2);
    expect(data.trendingRepos[0].gitPOAPCount).toEqual(4);
    expect(data.trendingRepos[1].name).toEqual('gitpoap-fe');
    expect(data.trendingRepos[1].mintedGitPOAPCount).toEqual(1);
    expect(data.trendingRepos[1].contributorCount).toEqual(1);
    expect(data.trendingRepos[1].gitPOAPCount).toEqual(3);
  });
});
