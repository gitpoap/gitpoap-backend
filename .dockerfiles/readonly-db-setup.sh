#!/bin/bash

DATABASE_URL=postgresql://postgres:foobar88@db:5432
READONLY_USER=gitpoap_readonly_db_user 
READONLY_PASSWORD=foobar99

# Note that if this needs to change for new tables/etc, then the AWS
# role will need to be updated as well!
exec psql -v ON_ERROR_STOP=1 $DATABASE_URL <<EOF
CREATE ROLE $READONLY_USER LOGIN PASSWORD '$READONLY_PASSWORD';
GRANT USAGE ON SCHEMA public TO $READONLY_USER;
GRANT SELECT ON "Claim" TO $READONLY_USER;
GRANT SELECT ON "FeaturedPOAP" TO $READONLY_USER;
GRANT SELECT ON "GithubPullRequest" TO $READONLY_USER;
GRANT SELECT ON "GitPOAP" TO $READONLY_USER;
GRANT SELECT ON "Organization" TO $READONLY_USER;
GRANT SELECT ON "Profile" TO $READONLY_USER;
GRANT SELECT ON "Repo" TO $READONLY_USER;
GRANT SELECT ON "User" TO $READONLY_USER;
-- We need to expose Secret so the public API can interface with POAP
GRANT SELECT ON "Secret" TO $READONLY_USER;
EOF
