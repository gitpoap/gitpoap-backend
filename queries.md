# Queries

This document describes how to accomplish some of the common backend
queries via the GraphQL endpoint.

## Banner Stats

For this query, the caller will need to resolve the date stamp to
a week ago before sending the query (Unfortunately it does not seem
that this is possible in GraphQL itself). It can be done with:
```javascript
new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
```

The query itself is:
```graphql
{
 contributors: aggregateUser {_count {id}}
 lastWeekContributors: aggregateUser(where: {createdAt: {gt: "2022-02-22"}}) {
  _count {id}
 }
 gitPOAPs: aggregateGitPOAP {_count {id}}
 lastWeekGitPOAPs: aggregateGitPOAP(where: {createdAt: {gt: "2022-02-22"}}) {
  _count {id}
 }
 projects: aggregateRepo {_count {id}}
 lastWeekProjects: aggregateRepo(where: {createdAt: {gt: "2022-02-22"}}) {
  _count {id}
 }
}
```
