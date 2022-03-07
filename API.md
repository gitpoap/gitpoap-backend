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

POST `/profile`

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
for the data in the `"data"` field (i.e. a signature for `JSON.stringify(obj.data)`) using
[`signMessage`](https://docs.ethers.io/v5/api/signer/#Signer-signMessage) from `ethers`.
