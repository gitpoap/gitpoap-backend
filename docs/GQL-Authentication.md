# GQL Authentication

To use GQL for any non-logged in user, requests should be sent with an
`Authorization` HTTP header like:
```typescript
  req.headers['Authorization'] = 'Bearer null'
```
On the other hand, if the frontend also has a JWT token for a logged-in user, this
should be provided with the authentication, so that the backend can use this for
user-specific GQL queries and mutations:
```typescript
  req.headers['Authorization'] = `Bearer ${USER_JWT_TOKEN}`;
```

## Writing User-specific GQL Routes:

A user-specific GQL route can be written like:
```typescript
  // This will not allow access if user = null in the `Authorization` header
  @Authorized(AuthRoles.Address)
  @Query(() => String)
  async someRoute(@Ctx() { prisma, userAccessTokenPayload }: AuthContext) {
    // Note that this case should not be possible since the Address role is required
    if (userAccessTokenPayload === null || userAccessTokenPayload.address === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      throw InternalError;
    }

    // The route can now use the payload as it sees fit
  }
```

There are two roles available:
* `AuthRoles.Address`: This requires that a valid JWT token be set for `user` in the
    `Authorization` HTTP header.
* `AuthRoles.Staff` This requires a valid JWT token be set for `user` in the
    `Authorization` HTTP header, and the user that this token corresponds to be a
    staff member of GitPOAP

To check if a user has a specific role on a team, one can use something like:
```typescript
  // This will not allow access if user = null in the `Authorization` header
  @Authorized(AuthRoles.Address)
  @Query(() => String, { nullable: true })
  async someRoute(@Ctx() { prisma, userAccessTokenPayload }: AuthContext) {
    // Note that this case should not be possible since the Address role is required
    if (userAccessTokenPayload === null || userAccessTokenPayload.address === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      throw InternalError;
    }

    if (!hasMembership(userAccessTokenPayload, SOME_TEAM_ID, [MembershipRole.ADMIN])) {
      logger.warn(`User is not a member of ${SOME_TEAM_ID}`);
      return null;
    }

    // The route can now use the payload as it sees fit
  }
```
