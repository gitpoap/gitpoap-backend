# Creating a Read-Only DB User

To create a read-only DB user, we first generate a password like so:

```sh
tr -dc A-Za-z0-9 </dev/urandom | head -c 50 ; echo ''
```

Then log into the DB via `psql` and run:

```sql
CREATE ROLE <Your-User> LOGIN PASSWORD 'yyy';
GRANT USAGE ON SCHEMA public TO <Your-User>;
```

We should only be allowing access to non-secret tables, so we can run the following
to allow only `SELECT` statements on these tables:

```sql
GRANT SELECT ON "Claim" TO <Your-User>;
GRANT SELECT ON "FeaturedPOAP" TO <Your-User>;
GRANT SELECT ON "GithubPullRequest" TO <YourUser>;
GRANT SELECT ON "GitPOAP" TO <Your-User>;
GRANT SELECT ON "Organization" TO <Your-User>;
GRANT SELECT ON "Profile" TO <Your-User>;
GRANT SELECT ON "Repo" TO <Your-User>;
GRANT SELECT ON "User" TO <Your-User>;
```
