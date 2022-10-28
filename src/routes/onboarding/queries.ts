export const publicPRsQuery = (userName: string) => `
{
  search(
    query: "author:${userName} is:pr is:public is:merged"
    type: ISSUE
    first: 100
  ) {
    issueCount
    edges {
      node {
        ... on PullRequest {
          title
          repository {
            databaseId
            name
            nameWithOwner
            viewerPermission
            description
            url
            isFork
            stargazerCount
            owner {
              id
              __typename
              avatarUrl
              login
              resourcePath
            }
          }
        }
      }
    }
  }
}
`;
