#!/bin/sh

set -e

if [ -z ${GITHUB_OAUTH_TOKEN+x} ]; then
  echo 'Required ENV variable GITHUB_OAUTH_TOKEN is not set'
  exit 1
fi

if [ -z ${DATABASE_URL+x} ]; then
  echo 'Required ENV variable DATABASE_URL is not set'
  exit 2
fi

echo DB-MIGRATOR: Cloning gitpoap-backend...

git clone "https://${GITHUB_OAUTH_TOKEN}@github.com/gitpoap/gitpoap-backend.git"

cd gitpoap-backend

echo DB-MIGRATOR: Installing node dependencies...

yarn

echo DB-MIGRATOR: Running deployment...

npx prisma migrate deploy

echo DB-MIGRATOR: Finished running migrations successfully

exit 0
