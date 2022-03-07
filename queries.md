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
      claim {
        gitPOAP {
          repo {
            name
          }
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
      "gitPOAPs": [
        {
          "claim": {
            "gitPOAP": {
              "repo": {
                "name": "repo34"
              }
            }
          },
          "poap": {
            "event": {
              "name": "Welcome to the Thunderdome",
              "image_url": "https://avatars.githubusercontent.com/u/1555326?v=4"
            },
            "tokenId": "thunderdome"
          }
        }
      ],
      "poaps": [
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

# User's Open Claims

To retrieve a user's available Claims (i.e. in the state `UNCLAIMED`), we can run
a query like:

```graphql
{
  userClaims(githubId: 2) {
    claim {
      id
    }
    event {
      name
      image_url
    }
  }
}
```

that returns data like:

```json
{
  "data": {
    "userClaims": [
      {
        "claim": {
          "id": 2
        },
        "event": {
          "name": "ethdenver",
          "image_url": "https://avatars.githubusercontent.com/u/1455326?v=4"
        }
      }
    ]
  }
}
```

# Profile Data

To retrieve the profile data for an address, we can run a query like:

```graphql
{
  profileData(address: "burz.eth") {
    id
    bio
    name
  }
}
```

that returns data like:

```json
{
  "data": {
    "profileData": {
      "id": 4,
      "bio": "I am addicted to POAPs",
      "name": "Anthony Burzillo"
    }
  }
}
```
