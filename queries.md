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
  lastWeekMostHonoredContributors(count: 10) {
    user {
      id
      githubHandle
    }
    claimsCount
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
        "claimsCount": 1
      }
    ]
  }
}
```

### Address's POAPs and GitPOAPs

The query to get an address's (or an ENS's) POAPs and GitPOAPs is as follows:

```graphql
{
  userPOAPs(address: "burz.eth") {
    gitPOAPs {
      gitPOAP {
        repo {
          name
        }
      }
      poap {
        event {
          name
          image_url
        }
        tokenId
      }
    }
    poaps {
      event {
        name
        image_url
      }
      tokenId
    }
  }
}
```

and returns data in the form:

```json
{
  "data": {
    "userPOAPs": {
      "gitPOAPs": [],
      "poaps": [
        {
          "event": {
            "name": "Welcome to the Thunderdome",
            "image_url": "https://avatars.githubusercontent.com/u/1555326?v=4"
          },
          "tokenId": "thunderdome"
        },
        {
          "event": {
            "name": "ethdenver",
            "image_url": "https://avatars.githubusercontent.com/u/1455326?v=4"
          },
          "tokenId": "ethdenver"
        }
      ]
    }
  }
}
```
