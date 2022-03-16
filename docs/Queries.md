# Queries

This document describes how to accomplish some of the common backend
queries via the GraphQL endpoint.

## Banner Stats

The query to get the banner stats is as follows:

```graphql
{
  totalContributors
  lastMonthContributors
  totalGitPOAPs
  lastMonthGitPOAPs
  totalRepos
  lastMonthRepos
}
```

and returns data in the form:

```json
{
  "data": {
    "totalContributors": 5,
    "lastMonthContributors": 4,
    "totalGitPOAPs": 3,
    "lastMonthGitPOAPs": 2,
    "totalRepos": 3,
    "lastMonthRepos": 2
  }
}
```

## Most Honored Contributors

The query to get the most honored contributors is as follows:

```graphql
{
  mostHonoredContributors(count: 10) {
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
    "mostHonoredContributors": [
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

## Address's POAPs and GitPOAPs

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

## User's Open Claims

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

## Profile Data

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

## Most Claimed GitPOAPs

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

## Recently Added Projects

To retrieve a list of the most recently added projects, we can run a query like:

```graphql
{
  recentlyAddedProjects(count: 2) {
    id
    name
    createdAt
    organization {
      name
    }
  }
}
```

that returns data like:

```
{
  "data": {
    "recentlyAddedProjects": [
      {
        "id": 3,
        "name": "repo568",
        "createdAt": "2022-03-07T23:53:35.865Z",
        "organization": {
          "name": "some-other-org"
        }
      },
      {
        "id": 2,
        "name": "repo7",
        "createdAt": "2022-03-07T23:53:35.859Z",
        "organization": {
          "name": "seven-heaven"
        }
      }
    ]
  }
}
```

## String Searching

To search by a string (could be a name, address, or ENS name), we can run a query like:

```graphql
{
  search(text: "b") {
    usersByGithubHandle {
      id
      githubHandle
    }
    profilesByName {
      id
      name
    }
    profilesByAddress {
      id
      address
    }
    profileByENS {
      profile {
        id
        address
      }
      ens
    }
  }
}
```

that returns data like:

```javascript
{
  "data": {
    "search": {
      "usersByGithubHandle": [
        {
          "id": 1,
          "githubHandle": "vitalikb"
        },
        {
          "id": 3,
          "githubHandle": "jaypb1"
        },
        {
          "id": 4,
          "githubHandle": "anthonyb"
        }
      ],
      "profilesByName": [
        {
          "id": 3,
          "name": "Jay PB"
        },
        {
          "id": 4,
          "name": "Anthony Burzillo"
        }
      ],
      "profilesByAddress": [
        {
          "id": 1,
          "address": "0x56d389c4e07a48d429035532402301310b8143a0"
        },
        {
          "id": 2,
          "address": "0x89dab21047e6de0e77deee5f4f286d72be50b942"
        },
        {
          "id": 3,
          "address": "0xae32d159bb3abfcadfabe7abb461c2ab4805596d"
        },
        {
          "id": 4,
          "address": "0xae95f7e7fb2fcf86148ef832faed2752ae5a358a"
        },
        {
          "id": 5,
          "address": "0x206e554084beec98e08043397be63c5132cc01a1"
        }
      ],
      "profileByENS": null
    }
  }
}
```

As an example for ENS:

```graphql
{
  search(text: "burz.eth") {
    usersByGithubHandle {
      id
      githubHandle
    }
    profilesByName {
      id
      name
    }
    profilesByAddress {
      id
      address
    }
    profileByENS {
      profile {
        id
        address
      }
      ens
    }
  }
}
```

returns:

```javascript
{
  "data": {
    "search": {
      "usersByGithubHandle": [],
      "profilesByName": [],
      "profilesByAddress": [],
      "profileByENS": {
        "profile": {
          "id": 4,
          "address": "0xae95f7e7fb2fcf86148ef832faed2752ae5a358a"
        },
        "ens": "burz.eth"
      }
    }
  }
}
```

## Profile's Featured POAPs

To view a profile's featured POAPs, one can run a query like the following with an
address or ENS:

```graphql
{
  profileFeaturedPOAPs(address: "0x206e554084beec98e08043397be63c5132cc01a1") {
    gitPOAPs {
      claim {
        id
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
    }
  }
}
```

That returns data like:

```json
{
  "data": {
    "profileFeaturedPOAPs": {
      "gitPOAPs": [
        {
          "claim": {
            "id": 17
          },
          "poap": {
            "event": {
              "name": "You've met Burz!"
            }
          }
        }
      ],
      "poaps": []
    }
  }
}
```

## GitPOAP Holders

To view information about the holders of some GitPOAP, we can run a query like:

```graphql
{
  gitPOAPHolders(gitPOAPId: 5, sort: "claim-count", page: 1, perPage: 2) {
    totalHolders
    holders {
      profileId
      address
      bio
      profileImageUrl
      githubHandle
      twitterHandle
      personalSiteUrl
      gitPOAPCount
    }
  }
}
```

That returns data like:

```json
{
  "data": {
    "gitPOAPHolders": {
      "totalHolders": 3,
      "holders": [
        {
          "profileId": 4,
          "address": "0xae95f7e7fb2fcf86148ef832faed2752ae5a358a",
          "bio": "I am addicted to POAPs",
          "profileImageUrl": null,
          "githubHandle": "burz",
          "twitterHandle": null,
          "personalSiteUrl": null,
          "gitPOAPCount": 3
        },
        {
          "profileId": 1,
          "address": "0x56d389c4e07a48d429035532402301310b8143a0",
          "bio": "I like brisket.",
          "profileImageUrl": null,
          "githubHandle": "colfax23",
          "twitterHandle": null,
          "personalSiteUrl": null,
          "gitPOAPCount": 1
        }
      ]
    }
  }
}
```

Note that `page` and `perPage` are optional but must be specified. The options for `sort` are:

- `"claim-date"` (default): sort the holders by the time they claimed the GitPOAP (descending)
- `"claim-count"`: sort the holders by the number of claimed GitPOAPs they have (descending)
