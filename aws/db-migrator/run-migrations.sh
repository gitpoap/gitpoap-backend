#!/bin/sh

set -e

log() {
  >&2 echo "$1"
}

if [ -z ${DATABASE_URL+x} ]; then
  log 'Required ENV variable DATABASE_URL is not set'
  exit 1
fi

log 'DB-MIGRATOR: Creating WORKDIR...'

WORKDIR=$(mktemp -d)

log 'DB-MIGRATOR: Moving repository...'

cp -r /var/repos/gitpoap-backend $WORKDIR

log 'DB-MIGRATOR: Pulling gitpoap-backend...'

cd $WORKDIR/gitpoap-backend

# Ensure that we are tracking the branch from origin even
# if it's diverged for some reason (for instance a rebase)
git fetch origin $REPO_BRANCH 1>&2
git reset --hard "origin/$REPO_BRANCH" 1>&2

log 'DB-MIGRATOR: installing yarn packages...'

# Disable postinstall step for prisma generate
jq "del(.scripts.postinstall)" package.json > package.new.json
mv package.new.json package.json

mkdir -p /tmp/npm /tmp/yarn/cache /tmp/yarn/global /tmp/fake-home
export HOME=/tmp/fake-home
yarn 1>&2

log 'DB-MIGRATOR: Running deployment...'

npx prisma migrate deploy 1>&2

log 'DB-MIGRATOR: Finished running migrations successfully'

cd ~

rm -rf $WORKDIR

exit 0
