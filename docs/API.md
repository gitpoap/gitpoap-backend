# API

## Add Project

`POST /projects`

Data:

```json
{
  "organization": "some_org",
  "repository": "some_repo"
}
```

## Update Profile

`POST /profiles`

Data:

```json
{
  "address": "some address or ENS",
  "data": {
    "bio": "something cool, I guess"
  },
  "signature": "John Hancock"
}
```

Note that the `"data"` object can accept additional (nullable) fields to update. Fields
that are not specified in `"data"` will not be updated (or made to be `null`).

Also note that `"signature"` should sign something with the `"address"` like the following
(which corresponds with the data above):

```json
{
  "site": "gitpoap.io",
  "method": "POST /profiles",
  "data": {
    "bio": "something cool, I guess"
  }
}
```

where `"data"` is the same as in the request.
See [the appendix](https://github.com/gitpoap/gitpoap-backend/blob/main/API.md#generating-signatures)
for further information.

## Claim GitPOAPs

`POST /claims`

Data:

```json
{
  "claimIds": [4, 5],
  "address": "colfax.eth",
  "signature": "it is I"
}
```

The "signature" should contain the signature that the `"address"` generated for data like:

```json
{
  "site": "gitpoap.io",
  "method": "POST /claims",
  "claimIds": [4, 5]
}
```

where `"claimIds"` is the same as in the request.
See [the appendix](https://github.com/gitpoap/gitpoap-backend/blob/main/API.md#generating-signatures)
for further information.

## Feature a POAP

`PUT /featured`

Data:

```json
{
  "address": "0x206e554084BEeC98e08043397be63C5132Cc01A1",
  "poapTokenId": "123456789",
  "signature": "siggy wiggy"
}
```

The "signature" should contain the signature that the `"address"` generated for the following data:

```json
{
  "site": "gitpoap.io",
  "method": "PUT /featured",
  "poapTokenId": "123456789"
}
```

where `"poapTokenId"` is the same as in the request.
See [the appendix](https://github.com/gitpoap/gitpoap-backend/blob/main/API.md#generating-signatures)
for further information.

## Remove a Featured POAP

`DELETE /featured/:id` - where `:id` is the ID of the POAP (A.K.A. its `poapTokenId`)

Data:

```json
{
  "address": "0x206e554084BEeC98e08043397be63C5132Cc01A1",
  "signature": "siggy wiggy"
}
```

The "signature" should contain the signature that the `"address"` generated for the following data:

```json
{
  "site": "gitpoap.io",
  "method": "DELETE /featured/:id",
  "poapTokenId": "123456789"
}
```

where `"poapTokenId"` is the same as `":id"` in the request URL.
See [the appendix](https://github.com/gitpoap/gitpoap-backend/blob/main/API.md#generating-signatures)
for further information.

## Create a GitPOAP

`POST /gitpoaps`

Data:

```json
{
  "githubRepoId": 9001,
  "name": "GitPOAP Contributor 2022",
  "description": "You contributed to GitPOAP in 2022!\nCongrats, you are a super cool person!",
  "startDate": "01-Jan-2022",
  "endDate": "31-Dec-2022",
  "expiryDate": "31-Jan-2023",
  "year": 2022,
  "eventUrl": "https://github.com/gitpoap/gitpoap-backend",
  "image": "https://gitpoap.io/favicon.png",
  "email": "burz@gitpoap.io",
  "requestedCodes": 10
}
```

## Create Claims for a GitPOAP

`POST /claims/create`

Data:

```json
{
  "gitPOAPId": 6,
  "recipientGithubIds": [1555326]
}
```

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
