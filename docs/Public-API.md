# Public API

## Version 1

**Note that the public API limits individual IPs to a
maximum of 100 requests within a 5 minute window.**

### `GET /v1/poap/:poapTokenId/is-gitpoap`

This endpoint allows users to query whether some `poapTokenId` is a GitPOAP or not.
In the case that the `poapTokenId` corresponds to some claimed GitPOAP, the API will return
something like:

```json
{
  "isGitPOAP": true,
  "gitPOAPId": 4003
}
```

And in the case that it is not a GitPOAP:

```json
{
  "isGitPOAP": false
}
```

### `GET /v1/poap-event/:poapEventId/is-gitpoap`

This endpoint allows users to query whether some `poapEventId` is for GitPOAP project
contribution level. In the case that the `poapEventId` is for a GitPOAP project contribution
level, it will return something like:

```json
{
  "isGitPOAP": true,
  "gitPOAPId": 3001
}
```

And in the case that it is not a GitPOAP project contribution level:

```json
{
  "isGitPOAP": false
}
```

### `GET /v1/gitpoaps/:gitpoapId/addresses`

This endpoint allows users to query for a list of addresses that hold a GitPOAP specified by ID. It returns something like:

```json
{
  "addresses": [
    "0x4b412F5eF87A2F85Fc8C6f90728d2D03941aFd80",
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
  ]
}
```

If there are no holders, it returns something like:

```json
{
  "addresses": []
}
```

And in the case that no GitPOAP with that ID is found, it returns the following with a 404:

```json
{
  "message": "GitPOAP not found"
}
```

### `GET /v1/gitpoaps/addresses`

This endpoint allows users to query for a list of all addresses that hold any GitPOAP. It returns something like:

```json
{
  "addresses": [
    "0x4b412F5eF87A2F85Fc8C6f90728d2D03941aFd80",
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "0x02738d122e0970aAf8DEADf0c6A217a1923E1e99",
    "0xae95f7e7fb2fcf86148ef832faed2752ae5a358a"
  ]
}
```

### `GET /v1/address/:address/gitpoaps`

This endpoint allows users to query for some address's (either and ETH or ENS
address) GitPOAPs. This returns data like:

```json
[
  {
    "gitPoapId": 34,
    "gitPoapEventId": 32423,
    "poapTokenId": "2432",
    "poapEventId": 343,
    "name": "GitPOAP: gitpoap-docs Level 2 Contributor 2022",
    "year": 2022,
    "description": "You've made at least 5 contributions to the gitpoap-docs project in 2022!",
    "imageUrl": "https://assets.poap.xyz/gitpoap-2022-devconnect-hackathon-gitpoap-team-contributor-2022-logo-1650466033470.png",
    "repositories": ["gitpoap/gitpoap-docs"],
    "earnedAt": "2022-04-25",
    "mintedAt": "2022-05-22"
  }
]
```

### `GET /v1/github/user/:githubHandle/gitpoaps`

This endpoint allows users to query for minted GitPOAPs associated with a specified GitHub handle. This returns data like:

```json
[
  {
    "gitPoapId": 34,
    "gitPoapEventId": 32423,
    "poapTokenId": "2432",
    "poapEventId": 343,
    "name": "GitPOAP: gitpoap-docs Level 2 Contributor 2022",
    "year": 2022,
    "description": "You've made at least 5 contributions to the gitpoap-docs project in 2022!",
    "imageUrl": "https://assets.poap.xyz/gitpoap-2022-devconnect-hackathon-gitpoap-team-contributor-2022-logo-1650466033470.png",
    "repositories": ["gitpoap/gitpoap-docs"],
    "earnedAt": "2022-04-25",
    "mintedAt": "2022-05-22"
  }
]
```

### `GET /v1/repo/:owner/:name/badge`

This endpoint generates GitHub badges containing the GitPOAP count for a specified repo. The repo is specified with an owner and name. This returns a SVG for use in a repo's `README.md` that looks like the following (using `ethereum/ethereum-org-website` as an example):

[![gitpoaps](https://public-api.gitpoap.io/v1/repo/seven-heaven/repo7/badge)](https://gitpoap.io/gh/ethereum/ethereum-org-website)
