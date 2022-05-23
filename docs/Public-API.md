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
