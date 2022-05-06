#!/bin/sh

set -e

echo DB-MIGRATOR: Cloning gitpoap-backend...

git clone "https://${GITHUB_OAUTH_TOKEN}@github.com/gitpoap/gitpoap-backend.git"

cd gitpoap-backend

echo DB-MIGRATOR: Installing node dependencies...

yarn

echo DB-MIGRATOR: Running deployment...

npx prisma migrate deploy

echo DB-MIGRATOR: Finished running migrations successfully

exit 0
