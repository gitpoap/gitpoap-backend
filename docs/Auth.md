# Auth

For our REST API we use the OAuth scheme of providing a short lived Access Token
and a Refresh token to the user when they login via GitHub. This helps us since
we don't want our users to have to:

- Repeatedly log into the site
- Hold never-expiring authentication tokens that could be leaked and used
  maliciously

With the Access+Refresh Token system, the user is given both at the same time but
the user will only use the Access Token when making requests (note that we need to
assume that the distribution of these tokens initially to the user is secure) until
the user (i.e. the frontend) realizes that the token has expired. At this point
they can exchange their Refresh Token, which they stored on the frontend until
they needed it, at the backend's refresh token endpoint for a new
Access+Refresh Token.

## Access Token Format

The Access Token is a [JWT](https://jwt.io/) token that has a payload with the following
fields:

```typescript
type AccessTokenPayload = {
  authTokenId: number;
  addressId: number;
  address: string;
  ensName: string | null;
  ensAvatarImageUrl: string | null;
  githubId: number | null;
  githubHandle: string | null;
};
```

Note that:

- The `authTokenId` field is the ID of the record in the `AuthToken` table for the
  Access+Refresh Token pair in the database.
- The `addressId` field is the ID of the record in the `Address` table for the
  Access+Refresh Token pair in the database that is the address that is logged in
- The `address` field is the (lowercased) full address of the user.
- The `ensName` field is the ENS name of the logged in user (if they have one)
- The `ensAvatarImageUrl` field is the URL for the ENS avatar of the logged in user
    (if they have one). Note that this will always be `null` if `ensName === null`.
- The `githubId` field is GitHub's ID for the user that will not change even if their
  login handle changes. Note that if this is `null` then the user is *not* currently
  logged into GitHub.
- The `githubHandle` field is GitHub's current login handle for the user. Note that
  this will always be `null` if `githubId === null`.

The inclusion of these fields allows the REST server to skip having to look up the user
or to validate that the token is still valid (there are scenarios where we may invalidate
a token before it has expired that we will describe in another section).

Access Tokens have short expiration times by design. We are currently using 10 minutes.

## Refresh Token Format

The Refresh Token is a [JWT](https://jwt.io/) token that has a payload with the following
fields:

```typescript
export type RefreshTokenPayload = {
  authTokenId: number;
  addressId: number;
  generation: number;
};
```

Note that:

- The `authTokenId` field is the ID of the record in the `AuthToken` table for the
  Access+Refresh Token pair in the database.
- The `addressId` field is the ID of the record in the `Address` table for the
  Access+Refresh Token pair in the database that is the address that is logged in
- The `generation` field is a versioning of the Access+Refresh Tokens for a single login.
  After a user logs in , their new Access+Refresh Tokens have a `generation` of `0`
  and each time the user uses the Refresh Token to get a new pair this `generation` is incremented.

The user (i.e. the frontend) should store this token in either local storage or a cookie until they
need to use it.

Refresh Tokens never expire, but they may be invalidated.

## Invalidation Scenarios

There are a few scenarios in which a token pair will be invalidated:

- If someone attempts to use a Refresh Token from a previous generation (e.g. the current generation
  is `4` but someone attempts to refresh with a Refresh Token from generation `2`) then we must assume
  that the tokens have been leaked and we invalidate the Access+Refresh Token pair and the user will
  have to log in again.
- If it has been over 1 month since the user logged in.

To invalidate, we simply delete the record for the token pair in the DB.

## Client Usage

### Making Requests

To make a request that requires authentication, the client should include the header

```
Authorization: Bearer {your token}
```

in their request.

### Requesting a New Token Pair

To request a new Access+Refresh the frontend should (1) ensure that the user is connected to their wallet and
then ask them to sign a message like the following:
```
This signature attests that I am 0xae95f7e7fb2fcf86148ef832faed2752ae5a358a, for the purpose of signing into GitPOAP.

Signing this message requires no ETH and will not create or send a transaction.

Created at: 1666638270342.
```
See [the appendix](#generating-signatures) for more information on how to create signatures.

Then the frontend should call `POST /auth` with the following body:
```json
{
  "address": "0xae95f7e7fb2fcf86148ef832faed2752ae5a358a",
  "signatureData": {
    "signature": "John Hancock",
    "message": "The message that was signed",
    "createdAt": 1666638270342
  }
}
```
where `signature` is the string returned by signing the data above.

**Note that this must be the *resolved* address of the user, this endpoint will not accept ENS names.**

If everything checks out, the backend server will return two tokens like:

```json
{
  "accessToken": "the access token string",
  "refreshToken": "the refresh token string"
}
```

if the code the client sent was valid.

### Signing into GitHub

First, the user must have been signed in via their address as in the above section

To retrieve a new token pair where the user is logged into GitHub, the client (i.e. the frontend) should
[send the user to the GitHub login page](https://docs.github.com/en/developers/apps/building-github-apps/identifying-and-authorizing-users-for-github-apps#1-request-a-users-github-identity)
to retreive a code. GitHub will then redirect the user back to the site
with their secret code and at that point the client should send a
`POST /github` request with a payload like:

```json
{
  "code": "{your code}"
}
```

while providing their address-based JWT access token, and the backend server will return two new tokens like:

```json
{
  "accessToken": "the access token string",
  "refreshToken": "the refresh token string"
}
```

if the code the client sent was valid. This new `accessToken` will now have both `githubId` and `githubHandle` filled in.
If, instead, the code was invalid, the backend will return an error status and the client should continue using the
previous JWT pair.

### Requesting a Token Pair with a Refresh Token

If the client (i.e. the frontend) has a Refresh Token and their Access Token has expired
(the expiration is _not_ required) they can request a new token pair by sending a
`POST /github/refresh` with a payload like:

```json
{
  "token": "{your refresh token}"
}
```

and the backend server will return two tokens like:

```json
{
  "accessToken": "the access token string",
  "refreshToken": "the refresh token string"
}
```

if the Refresh Token the client sent was valid.

**Note:** If you attempt to use the old Refresh Token again you will invalidate your
login and you will have to log in GitHub again.

## Appendix

### Generating Signatures

To generate signatures for arbitrary data in the request, just use
[`signMessage`](https://docs.ethers.io/v5/api/signer/#Signer-signMessage) from `ethers`
and pass in the data as a JSON string. For example, given an (`ethers`) `web3Provider`
in the frontend, we could generate a signature for a request like:

```javascript
const signature = await web3Provider.getSigner().signMessage('Some message');
```

_Note that the signatures for the requests in this document should have the order of
their keys in the same order as they appear here._

## Some Additional Reading

- [GitHub Auth: Web Application Flow](https://docs.github.com/en/developers/apps/building-github-apps/identifying-and-authorizing-users-for-github-apps#web-application-flow)
- [`jsonwebtoken` package](https://www.npmjs.com/package/jsonwebtoken)
- [What Are Refresh Tokens and How to Use Them Securely](https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/)
