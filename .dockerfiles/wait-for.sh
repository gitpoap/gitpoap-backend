#!/bin/bash

SLEEP_TIME=10

if [ $# != 1 ]; then
  echo 'Missing URL to wait for!'
  exit 1
fi

# Wait for seeding to complete (the server port becomes available)
while ! curl -sf $1; do
  echo "Waiting for server at '$1' to start. Sleeping for $SLEEP_TIME seconds..."
  sleep $SLEEP_TIME
done

echo "Server at '$1' is up!"
