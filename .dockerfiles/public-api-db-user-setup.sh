#!/bin/bash

DATABASE_URL=postgresql://postgres:foobar88@db:5432
PUBLIC_API_USER=gitpoap_public_api_db_user
PUBLIC_API_PASSWORD=foobar99

# Note that if this needs to change for new tables/etc, then the AWS
# role will need to be updated as well!
exec psql -v ON_ERROR_STOP=1 $DATABASE_URL <<EOF
CREATE ROLE $PUBLIC_API_USER LOGIN PASSWORD '$PUBLIC_API_PASSWORD';
GRANT USAGE ON SCHEMA public TO $PUBLIC_API_USER;
GRANT SELECT, INSERT, UPDATE ON "Address" TO $PUBLIC_API_USER;
GRANT USAGE, SELECT ON SEQUENCE "Address_id_seq" TO $PUBLIC_API_USER;
GRANT SELECT ON "Claim" TO $PUBLIC_API_USER;
GRANT SELECT ON "Email" TO $PUBLIC_API_USER;
GRANT SELECT ON "FeaturedPOAP" TO $PUBLIC_API_USER;
GRANT SELECT ON "GithubPullRequest" TO $PUBLIC_API_USER;
GRANT SELECT ON "GitPOAP" TO $PUBLIC_API_USER;
GRANT SELECT ON "Organization" TO $PUBLIC_API_USER;
-- The Public API can upsert Profiles for Addresses requested that haven't
-- yet been seen
GRANT SELECT, INSERT, UPDATE ON "Profile" TO $PUBLIC_API_USER;
GRANT USAGE, SELECT ON SEQUENCE "Profile_id_seq" TO $PUBLIC_API_USER;
GRANT SELECT ON "Repo" TO $PUBLIC_API_USER;
GRANT SELECT ON "User" TO $PUBLIC_API_USER;
GRANT SELECT ON "Project" TO $PUBLIC_API_USER;
-- We need to expose more on Secret so the public API can interface with POAP
GRANT SELECT, INSERT, UPDATE ON "Secret" TO $PUBLIC_API_USER;
GRANT USAGE, SELECT ON SEQUENCE "Secret_id_seq" TO $PUBLIC_API_USER;
EOF
