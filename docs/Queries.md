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
  totalClaims
  lastMonthClaims
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
    "totalClaims": 9,
    "lastMonthClaims": 9,
    "totalRepos": 3,
    "lastMonthRepos": 2
  }
}
```

## Most Honored Contributors

The query to get the most honored contributors is as follows:

```graphql
{
  mostHonoredContributors(count: 2) {
    profile {
      address
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
        "profile": {
          "address": "0xae32d159bb3abfcadfabe7abb461c2ab4805596d"
        },
        "claimsCount": 4
      },
      {
        "profile": {
          "address": "0xae95f7e7fb2fcf86148ef832faed2752ae5a358a"
        },
        "claimsCount": 3
      }
    ]
  }
}
```

## Repo Most Honored Contributors

The query to get a repo's most honored contributors is as follows:

```graphql
{
  repoMostHonoredContributors(count: 2, repoId: 1) {
    profile {
      address
    }
    claimsCount
  }
}
```

and returns data in the form:

```json
{
  "data": {
    "repoMostHonoredContributors": [
      {
        "profile": {
          "address": "0xae32d159bb3abfcadfabe7abb461c2ab4805596d"
        },
        "claimsCount": 4
      },
      {
        "profile": {
          "address": "0xae95f7e7fb2fcf86148ef832faed2752ae5a358a"
        },
        "claimsCount": 3
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
        status
        poapTokenId
      }
      event {
        name
        image_url
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
            },
            "status": "COMPLETED",
            "poapTokenId": "thunderdome"
          },
          "event": {
            "name": "Welcome to the Thunderdome",
            "image_url": "https://avatars.githubusercontent.com/u/1555326?v=4"
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

## Repo GitPOAPs

The query to get a repo's GitPOAPs is as follows:

```graphql
{
  repoGitPOAPs(repoId: 1, sort: "alphabetical", page: 1, perPage: 2) {
    totalGitPOAPs
    gitPOAPs {
      gitPOAP {
        repo {
          name
        }
      }
      event {
        name
        image_url
      }
    }
  }
}
```

and returns data in the form:

```json
{
  "data": {
    "repoGitPOAPs": {
      "totalGitPOAPs": 1,
      "gitPOAPs": [
        {
          "gitPOAP": {
            "repo": {
              "name": "repo34"
            }
          }
          "event": {
            "name": "Welcome to the Thunderdome",
            "image_url": "https://avatars.githubusercontent.com/u/1555326?v=4"
          }
        }
      ]
    }
  }
}
```

Note that `page` and `perPage` are optional but must be specified. The options for `sort` are:

- `"date"` (default): sort the time they claimed the GitPOAP (descending)
- `"alphabetical"`: sort by the name of the GitPOAP (ascending)

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

## Organization Data

To retrieve info about a Organization including its contributorCount, gitPOAPCount, mintedGitPOAPCount and projectCount, we can run a query like:

```graphql
{
  organizationData(orgId: 5) {
    id
    name
    contributorCount
    gitPOAPCount
    mintedGitPOAPCount
    projectCount
  }
}
```

or

```graphql
{
  organizationData(orgName: "some-org", repoName: "some-repo") {
    id
    name
    contributorCount
    gitPOAPCount
    mintedGitPOAPCount
    projectCount
  }
}
```

that returns data like:

```json
{
  "data": {
    "organizationData": {
      "id": 5,
      "name": "some-repo",
      "contributorCount": 5,
      "gitPOAPCount": 3,
      "mintedGitPOAPCount": 8,
      "projectCount": 1
    }
  }
}
```

## All Organizations

To retrieve a list of all organizations, we can run a query like:

```graphql
{
  allOrganizations(sort: "alphabetical", page: 1, perPage: 1) {
    id
    name
    githubOrgId
    description
    twitterHandle
    url
    repos {
      id
    }
  }
}
```

That returns data like:

```json
{
  "data": {
    "allOrganizations": [
      {
        "id": 5,
        "name": "burz labz",
        "githubOrgId": 1555326,
        "description": null,
        "twitterHandle": null,
        "url": null,
        "repos": [
          {
            "id": 6
          }
        ]
      }
    ]
  }
}
```

Note that `page` and `perPage` are optional but must be specified. The options for `sort` are:

- `"alphabetical"` (default): sort the organizations name (ascending)
- `"date"`: sort the organizations by the date they were created (descending)

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

## All Repos

To retrieve a list of all organizations, we can run a query like:

```graphql
{
  allRepos(sort: "date", page: 1, perPage: 1) {
    id
    name
    githubRepoId
    organization {
      id
      name
    }
    gitPOAPs {
      poapEventId
    }
  }
}
```

That returns data like:

```json
{
  "data": {
    "allRepos": [
      {
        "id": 6,
        "name": "dopex",
        "githubRepoId": 127534193,
        "organization": {
          "id": 5,
          "name": "burz labz"
        },
        "gitPOAPs": [
          {
            "poapEventId": 34634
          }
        ]
      }
    ]
  }
}
```

Note that `page` and `perPage` are optional but must be specified. The options for `sort` are:

- `"alphabetical"` (default): sort the repo's name (ascending)
- `"date"`: sort by the date of creation (descending)
- `"gitpoap-count"`: sort by the number of gitPOAPs (descending)
- `"organization"`: sort by the name of the organization this repo belongs to (ascending)

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

## GitPOAP Event Info

To retrieve info about a GitPOAP event, we can run a query like:

```graphql
{
  gitPOAPEvent(id: 3) {
    gitPOAP {
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
    "gitPOAPEvent": {
      "gitPOAP": {
        "id": 3
      },
      "event": {
        "name": "DevCon1",
        "image_url": "https://www.poap.xyz/events/badges/devcon1.png"
      }
    }
  }
}
```

## Repo Data

To retrieve info about a Repo including its contributor count, we can run a query like:

```graphql
{
  repoData(repoId: 5) {
    id
    name
    contributorCount
  }
}
```

or

```graphql
{
  repoData(orgName: "some-org", repoName: "some-repo") {
    id
    name
    contributorCount
  }
}
```

that returns data like:

```json
{
  "data": {
    "repoData": {
      "id": 5,
      "name": "some-repo",
      "contributorCount": 4
    }
  }
}
```

## Repo Star Count

To retrieve the number of stars on a repo we can run a query like:

```graphql
  repoStarCount(repoId: 54)
```

that returns data like:

```json
{
  "data": {
    "repoStarCount": 5
  }
}
```
