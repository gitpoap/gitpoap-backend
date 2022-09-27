# Address-centric Auth Spec

This document describes how we will update the backend to use address-centric auth (as opposed to our current GitHub-centric auth).

## Overview

Currently we require that users sign with their wallet/address for every DB-changing interaction with the site
(Claiming GitPOAPs, Featuring POAPs, etc) while still validly logged into GitHub (i.e. their OAuth token is still valid).
This change will require that the user sign from their wallet/address only once and then they have the option to connect their
GitHub afterwards. Then they can interact with any address-only functionality (e.g. featuring GitPOAPs) while not validly logged
into GitHub without needing to resign.

The only times that they would need to resign is:
* From a different computer/phone
* After a certain amount of time has passed since they last signed (e.g. 1 month)

However, the users will need to connect their GitHub accounts:
* If their OAuth token has been invalidated (for instance, if they've disconnected the OAuth App on GitHub itself)
* From a new computer
* In order to see any GitPOAPs they have available
* In order to claim GitPOAPs
* In order to revalidate GitPOAPs that were transferred

Note that if they are on the same computer and need to resign, they should be able to immediately reconnect to GitHub
(if they were already) by clicking the "Connect to GitHub" button again.

## DB Changes

In order to accomplish these changes on the DB-side, we merely need to update the `AuthToken` table. The old table
looks like:
```prisma
model AuthToken {
  id               Int    @id @default(autoincrement())
  generation       Int    @default(0)
  githubOAuthToken String
  githubId         Int
  user             User   @relation(fields: [githubId], references: [githubId])
}
```
Whereas the new table will contain:
```prisma
model AuthToken {
  id               Int      @id @default(autoincrement())
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  generation       Int      @default(0)
  oldAddress       String   @db.VarChar(255)
  addressId        Int?
  address          Address? @relation(fields: [addressId], references: [id])
  githubOAuthToken String?
  githubId         Int?
  user             User?    @relation(fields: [githubId], references: [githubId])
}
```
I.e. token will now require an address to be specified with an optional GitHub setup via the OAuth App.

## JWT Payload Changes

Previously the JWT token payload had the type:
```typescript
export type AccessTokenPayload = {
  authTokenId: number;
  githubId: number;
  githubHandle: string;
};
```
The new JWT payload will look like:
```typescript
export type AccessTokenPayload = {
  authTokenId: number;
  address: string;
  githubId: number | null;
  githubHandle: string | null;
};
```
I.e. the GitHub-related fields are no longer required to interact with the site.

The middleware to check JWTs will be updated to validate that the `AuthToken` row in the DB for this payload
is still valid and that 1 month hasn't passed since the `AuthToken` was originally created.

## Endpoint Changes

We will remove the existing endpoint for creating GitHub-related JWTs, but will add a new one that handles
the Post-login step by accepting a valid Refresh token and a GitHub OAuth token to produce a new JWT pair with the
GitHub-related fields filled in.

As specified in the overview, all endpoints except the one to create the new JWT for an address (with or without GitHub
signed in yet) will no longer require a signature so long as the User's JWT is still valid.

The "Claim a GitPOAP" endpoint is the only endpoint that will need to be updated to require not only the address but
also the GitHub-related fields in the JWT AuthToken be valid.

## Summary

This involves three parts of changes (to be done in a single PR):
1. Update the DB
2. Update JWT middleware and AuthToken functionality/endpoints
3. Update existing endpoints (removing signature requirements/new checks on GitHub logins/etc)

The frontend will only need to update to:
1. Remove all signature requirements except when logging in
2. Handle situations where user needs to relogin
3. Send the GitHub OAuth token with the login if it already exists or send an existing JWT with the GitHub token
    after a user has logged in with GitHub after already doing a signature
4. Prompt the user to log into GitHub in order to see their claims
