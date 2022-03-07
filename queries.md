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
    totalGitPOAPs
    totalPOAPs
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
      "totalGitPOAPs": 1,
      "totalPOAPs": 1,
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

Additionally, a sort can be specified of either (default) `sort: "date"` (descending) or `sort: "alphabetical"` (ascending),
and the data can be paged by specifying `page: 1` and `perPage: 2` for example:

```graphql
{
  userPOAPs(address: "burz.eth", sort: "alphabetical", page: 1, perPage: 2) {
    totalGitPOAPs
    totalPOAPs
    gitPOAPs {
      claim {
        createdAt
      }
      poap {
        event {
          name
        }
      }
    }
    poaps {
      event {
        name
      }
      created
    }
  }
}
```

returns something like:

```json
{
  "data": {
    "userPOAPs": {
      "totalGitPOAPs": 2,
      "totalPOAPs": 4,
      "gitPOAPs": [
        {
          "claim": {
            "createdAt": "2022-03-07T22:17:46.876Z"
          },
          "poap": {
            "event": {
              "name": "ethdenver"
            }
          }
        },
        {
          "claim": {
            "createdAt": "2022-03-07T22:17:46.865Z"
          },
          "poap": {
            "event": {
              "name": "Welcome to the Thunderdome"
            }
          }
        }
      ],
      "poaps": [
        {
          "event": {
            "name": "You have met Patricio in February 2022"
          },
          "created": "2022-02-02"
        },
        {
          "event": {
            "name": "You've met Burz!"
          },
          "created": "2022-02-01"
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

# Most Claimed GitPOAPs

To retrieve a list of the most claimed GitPOAPs, we can run a query like:

```graphql
{
  mostClaimedGitPOAPs(count: 2) {
    claimsCount
    gitPOAP {
      id
    }
    event {
      name
    }
  }
}
```

that returns data like:

```json
{
  "data": {
    "mostClaimedGitPOAPs": [
      {
        "claimsCount": 2,
        "gitPOAP": {
          "id": 2
        },
        "event": {
          "name": "ethdenver"
        }
      },
      {
        "claimsCount": 1,
        "gitPOAP": {
          "id": 3
        },
        "event": {
          "name": "you ate some pizza pie"
        }
      }
    ]
  }
}
```
