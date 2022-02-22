#!/bin/sh

# Wait for db to finish starting up
sleep 3

# Setup the db
npx prisma migrate dev

# Make sure we've seeded our local db
npx prisma db seed

exec yarn run dev
