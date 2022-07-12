# API

## Update Profile

`POST /profiles`

Data:

```json
{
  "address": "some address or ENS",
  "data": {
    "bio": "something cool, I guess"
  },
  "signature": {
    "data": "John Hancock",
    "createdAt": 1647987506199
  }
}
```

Note that the `"data"` object can accept additional (nullable) fields to update. Fields
that are not specified in `"data"` will not be updated (or made to be `null`).
`"createdAt"` should be the number returned by `Date.now()`.

Also note that the `"signature"`'s `"data"` field should contain the signature created with the
`"address"` like the following:

```json
{
  "site": "gitpoap.io",
  "method": "POST /profiles",
  "createdAt": 1647987506199
  "data": {
    "bio": "something cool, I guess"
  }
}
```

where `"data"` and `"createdAt"` are the same as in the request.
See [the appendix](https://github.com/gitpoap/gitpoap-backend/blob/main/API.md#generating-signatures)
for further information.

## Claim GitPOAPs

`POST /claims`

Data:

```json
{
  "claimIds": [4, 5],
  "address": "colfax.eth",
  "signature": {
    "data": "it is I",
    "createdAt": 1647987506199
  }
}
```

`"createdAt"` should be the number returned by `Date.now()`.

Also note that the `"signature"`'s `"data"` field should contain the signature created with the
`"address"` like the following:

```json
{
  "site": "gitpoap.io",
  "method": "POST /claims",
  "createdAt": 1647987506199,
  "claimIds": [4, 5]
}
```

where `"claimIds"` and `"createdAt"` are the same as in the request.
See [the appendix](https://github.com/gitpoap/gitpoap-backend/blob/main/API.md#generating-signatures)
for further information.

## Feature a POAP

`PUT /featured`

Data:

```json
{
  "address": "0x206e554084BEeC98e08043397be63C5132Cc01A1",
  "poapTokenId": "123456789",
  "signature": {
    "data": "siggy wiggy",
    "createdAt": 1647987506199
  }
}
```

`"createdAt"` should be the number returned by `Date.now()`.

Also note that the `"signature"`'s `"data"` field should contain the signature created with the
`"address"` like the following:

```json
{
  "site": "gitpoap.io",
  "method": "PUT /featured",
  "createdAt": 1647987506199,
  "poapTokenId": "123456789"
}
```

where `"poapTokenId"` and `"createdAt"` are the same as in the request.
See [the appendix](https://github.com/gitpoap/gitpoap-backend/blob/main/API.md#generating-signatures)
for further information.

## Remove a Featured POAP

`DELETE /featured/:id` - where `:id` is the ID of the POAP (A.K.A. its `poapTokenId`)

Data:

```json
{
  "address": "0x206e554084BEeC98e08043397be63C5132Cc01A1",
  "signature": {
    "data": "siggy wiggy",
    "createdAt": 1647987506199
  }
}
```

`"createdAt"` should be the number returned by `Date.now()`.

Also note that the `"signature"`'s `"data"` field should contain the signature created with the
`"address"` like the following:

```json
{
  "site": "gitpoap.io",
  "method": "DELETE /featured/:id",
  "createdAt": 1647987506199,
  "poapTokenId": "123456789"
}
```

where `"poapTokenId"` is the same as `":id"` in the request URL, and `"createdAt"` is the same
as in the request body.
See [the appendix](https://github.com/gitpoap/gitpoap-backend/blob/main/API.md#generating-signatures)
for further information.

## Create a GitPOAP

`POST /gitpoaps`

This endpoint should receive the data as `multipart/form-data` with fields like the following (shown in JSON
for convenience):

```json
{
  "project": "{ \"githubRepoIds\": [ 9001 ], }", // JSON string
  "name": "GitPOAP Contributor 2022",
  "description": "You contributed to GitPOAP in 2022!\nCongrats, you are a super cool person!",
  "startDate": "01-Jan-2022",
  "endDate": "31-Dec-2022",
  "expiryDate": "31-Jan-2023",
  "year": 2022,
  "eventUrl": "https://github.com/gitpoap/gitpoap-backend",
  "email": "burz@gitpoap.io",
  "numRequestedCodes": 10,
  "ongoing": false,
  "city": "London", // optional
  "country": "UK" // optional
}
```

to create a project, or for an existing project:

```json
{
  "project": "{ \"id\": 5 }", // JSON string
  "name": "GitPOAP Contributor 2022",
  "description": "You contributed to GitPOAP in 2022!\nCongrats, you are a super cool person!",
  "startDate": "01-Jan-2022",
  "endDate": "31-Dec-2022",
  "expiryDate": "31-Jan-2023",
  "year": 2022,
  "eventUrl": "https://github.com/gitpoap/gitpoap-backend",
  "email": "burz@gitpoap.io",
  "numRequestedCodes": 10,
  "ongoing": false,
  "city": "London", // optional
  "country": "UK" // optional
}
```

Furthermore, there should be a part of the `multipart/form-data` named `"image"` that contains an uploaded
image.

Note that this endpoint requires that the (GitHub) authenticated user be an admin of GitPOAP,
as defined by [`ADMIN_GITHUB_IDS` at `src/constants.ts`](https://github.com/gitpoap/gitpoap-backend/blob/main/src/constants.ts).

## Create Claims for a GitPOAP

`POST /claims/create`

Data:

```json
{
  "gitPOAPId": 6,
  "recipientGithubIds": [1555326]
}
```

## Update Organization

`POST /organizations`

Data:

```json
{
  "id": 4,
  "data": {
    "description": "we do stuff",
    "url": null
  }
}
```

Note that `"data"` can accept multiple nullable fields to update.

The (GitHub) authenticated user must be an admin (not necessarily public)
of the organization whose info they are trying to update.

## Upload GitPOAP Codes

`POST /gitpoaps/codes`

To upload GitPOAPs from the `list.txt` file received from POAP in an email after
either (1) a GitPOAP has been approved or (2) after a successful `redeem-request`,
we can upload it to this endpoint via `multipart/form-data` with two input fields:

- `id`: the (our DB) ID of the GitPOAP we are uploading codes for
- `codes`: the `link.txt` file

Note that this endpoint requires that the (GitHub) authenticated user be an admin of GitPOAP,
as defined by [`ADMIN_GITHUB_IDS` at `src/constants.ts`](https://github.com/gitpoap/gitpoap-backend/blob/main/src/constants.ts).

## Check if a POAP is a GitPOAP

`GET /gitpoaps/poap-token-id/:id`

To check whether or not a POAP with `:id` is a GitPOAP or not. If not it will return a 404 status,
but if found it will return specific extra metadata like:

```JSON
{
  "year": 2020,
  "organization": "gitpoap",
  "repository": "gitpoap-backend"
}
```

## Add Repos to an Existing Project

`POST /projects/add-repos`

Data:

```json
{
  "projectId": 2342,
  "githubRepoIds": [2]
}
```

Note that the user submitting the request must have Admin credentials.

## Appendix

### Generating Signatures

To generate signatures for arbitrary data in the request, just use
[`signMessage`](https://docs.ethers.io/v5/api/signer/#Signer-signMessage) from `ethers`
and pass in the data as a JSON string. For example, given an (`ethers`) `web3Provider`
in the frontend, we could generate a signature for a request like:

```javascript
const signature = await web3Provider.getSigner().signMessage(
  JSON.stringify({
    bio: 'something cool, I guess',
  }),
);
```

_Note that the signatures for the requests in this document should have the order of
their keys in the same order as they appear here._
