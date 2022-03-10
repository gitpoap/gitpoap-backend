# Auth

For our REST API we use the OAuth scheme of providing a short lived Access Token
and a Refresh token to the user when they login via GitHub. This helps us since
we do not control the authentication server (i.e. GitHub) and we do not want our
users to have to:

- Repeatedly log into the site
- Hold never-expiring authentication tokens that could be leaked and used
  maliciously

With the Access+Refresh Token system, the user is given a both at the same time but
the user will only use the Access Token when making requests (note that we need to
assume that the distribution of these tokens initially to the user is secure) until
the user (i.e. the frontend) realizes that the token has expired. At this point
they can retreive a new Access+Refresh Token pair by calling the authentication refresh
endpoint and providing their Refresh Token.

## Access Token Format

The Access Token is a [JWT](https://jwt.io/) token that has a payload with the following
fields:

```json
{
  "authTokenId": 4,
  "githubId": 324234
}
```

Note that:

- The `"authTokenId"` field is the ID of the record for the Access+Refresh Token pair
  in the database.
- The `"githubId"` field is GitHub's ID for the user that will not change even if their
  login handle changes.

The inclusion of these fields allows the REST server to skip having to look up the user
or to validate that the token is still valid (there are scenarios where we may invalidate
a token before it has expired that we will describe in another section).

## Refresh Token Format

The Refresh Token is a [JWT](https://jwt.io/) token that has a payload with the following
fields:

```json
{
  "authTokenId": 4,
  "githubId": 324234,
  "generation": 5
}
```

Note that:

- The `"authTokenId"` field is the ID of the record for the Access+Refresh Token pair
  in the database.
- The `"githubId"` field is GitHub's ID for the user that will not change even if their
  login handle changes.
- The `"generation"` field is a versioning of the Access+Refresh Tokens for a single login.
  After a user logs in via GitHub, their new Access+Refresh Tokens have a generation of `0`
  and each time the user uses the Refresh Token to get a new pair this generation is incremented.

The user (i.e. the frontend) should store this token in either local storage or a cookie until they
need to use it.

## Invalidation Scenarios

There are a few scenarios in which a token pair will be invalidated:

- When the user tries to use the refresh token, we will ensure that the OAuth token we received from
  GitHub that is associated with this login in particular is still valid. In the case that it is
  not, it means that the user has disconnected the App in their GitHub settings.
- If someone attempts to use a Refresh Token from a previous generation (e.g. the current generation
  is `4` but someone attempts to refresh with a Refresh Token from generation `2`) then we must assume
  that the tokens have been leaked and we invalidate the Access+Refresh Token pair and the user will
  have to login via GitHub again.
  To invalidate, we simply delete the record for the token pair in the DB.

## Client Usage

### Making Requests

To make a request that requires authentication, the client should include the header

```
Authorization: Bearer {your token}
```

in their request.

### Requesting a New Token Pair

To retrieve a new token pair, the client (i.e. the frontend) should
[send the user to the GitHub login](https://docs.github.com/en/developers/apps/building-github-apps/identifying-and-authorizing-users-for-github-apps#1-request-a-users-github-identity)
to retreive a code. GitHub will then redirect the user back to the site
with their secret code and at that point the client should send a
`POST /github` request with a payload like:

```json
{
  "code": "{your code}"
}
```

and the server will return two tokens like:

```
{
  accessToken: "the access token string"
  refreshToken: "the refresh token string"
}
```

if the code the client sent was valid.

### Requesting a Token Pair with a Refresh Token

If the client (i.e. the frontend) has a Refresh Token and their Access Token has expired
(the expiration is _not_ required) they can request a new token pair by sending a
`POST /github/refresh` with a payload like:

```json
{
  "token": "{your refresh token}"
}
```

and the server will return two tokens like:

```
{
  accessToken: "the access token string"
  refreshToken: "the refresh token string"
}
```

if the Refresh Token the client sent was valid.

**Note:** If you attempt to use the old Refresh Token again you will invalidate your
login and you will have to log in via GitHub again.

## Some Additional Reading

- [GitHub Auth: Web Application Flow](https://docs.github.com/en/developers/apps/building-github-apps/identifying-and-authorizing-users-for-github-apps#web-application-flow)
- [`jsonwebtoken` package](https://www.npmjs.com/package/jsonwebtoken)
- [What Are Refresh Tokens and How to Use Them Securely](https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/)
