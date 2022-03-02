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
