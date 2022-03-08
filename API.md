# API

## Add Project

POST `/projects`

Data:

```json
{
  "organization": "some_org",
  "repository": "some_repo"
}
```

## Update Profile

POST `/profiles`

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

Also note that `"signature"` should contain the signature that the `"address"` generated
for the data in the `"data"` field.
See [the appendix](https://github.com/gitpoap/gitpoap-backend/blob/main/API.md#generating-signatures)
for further information.

## Claim GitPOAPs

POST `/claims`

Data:

```json
{
  "githubUserId": 3,
  "claimIds": [4, 5],
  "address": "colfax.eth",
  "signature": "it is I"
}
```

The "signature" should contain the signature that the `"address"` generated for the data
in the `"claimIds"` field.
See [the appendix](https://github.com/gitpoap/gitpoap-backend/blob/main/API.md#generating-signatures)
for further information.

# Appendix

## Generating Signatures

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
