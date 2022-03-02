# Queries

This document describes how to accomplish some of the common backend
queries via the GraphQL endpoint.

## Banner Stats

The query to get the banner stats is as follows:
```graphql
{
  totalContributors
  lastWeekContributors
  totalGitPOAPs
  lastWeekGitPOAPs
  totalRepos
  lastWeekRepos
}
```
and returns data in the form:
```json
{
  "data": {
    "totalContributors": 5,
    "lastWeekContributors": 4,
    "totalGitPOAPs": 3,
    "lastWeekGitPOAPs": 2,
    "totalRepos": 3,
    "lastWeekRepos": 2
  }
}
```

### Last Week's Most Honored Contributors

The query to get the most honored contributors from the last week is as follows:
```graphql
{
  lastWeekMostHonoredContributors(count:10) {
    user {
      id
      githubHandle
    }
    claims_count
  }
}
```
and returns data in the form:
```json
{
  "data": {
    "lastWeekMostHonoredContributors": [
      {
        "user": {
          "id": 2,
          "githubHandle": "colfaxs"
        },
        "claims_count": 1
      }
    ]
  }
}
```
