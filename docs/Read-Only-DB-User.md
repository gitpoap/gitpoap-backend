# Creating a Read-Only DB User

To create a read-only DB user, we first generate a password like so:

```sh
tr -dc A-Za-z0-9 </dev/urandom | head -c 50 ; echo ''
```

Then log into the DB via `psql` and run:

```sql
CREATE ROLE $READONLY_USER LOGIN PASSWORD 'yyy';
GRANT USAGE ON SCHEMA public TO $READONLY_USER;
```

We should only be allowing access to non-secret tables, so we can run the following
to allow only `SELECT` statements on these tables:

```sql
GRANT SELECT ON "Address" TO $READONLY_USER;
GRANT SELECT ON "Claim" TO $READONLY_USER;
GRANT SELECT ON "Email" TO $READONLY_USER;
GRANT SELECT ON "FeaturedPOAP" TO $READONLY_USER;
GRANT SELECT ON "GithubIssue" TO $READONLY_USER;
GRANT SELECT ON "GithubPullRequest" TO $READONLY_USER;
GRANT SELECT ON "GithubMention" TO $READONLY_USER;
GRANT SELECT ON "GitPOAP" TO $READONLY_USER;
GRANT SELECT ON "GitPOAPRequest" TO $READONLY_USER;
GRANT SELECT ON "GithubOrganization" TO $READONLY_USER;
GRANT SELECT ON "Team" TO $PUBLIC_API_USER;
GRANT SELECT ON "Membership" TO $PUBLIC_API_USER;
GRANT SELECT ON "Profile" TO $READONLY_USER;
GRANT SELECT ON "Repo" TO $READONLY_USER;
GRANT SELECT ON "GithubUser" TO $READONLY_USER;
GRANT SELECT ON "Project" TO $READONLY_USER;
```
