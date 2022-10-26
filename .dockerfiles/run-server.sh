#!/bin/sh

set -ex

# Wait for db to finish starting up
[ -f ./wait-for-it.sh ] && ./wait-for-it.sh db:5432

# Setup the db
npx prisma migrate dev

# Make sure we've seeded our local db
npx prisma db seed

yarn heat-up-ens-cache

exec yarn run dev --level debug
