#!/bin/bash

SLEEP_TIME=10

# Wait for seeding to complete (the server port becomes available)
while ! curl -sf server:3001; do
  echo "Waiting for server to start. Sleeping for $SLEEP_TIME seconds..."
  sleep $SLEEP_TIME
done

echo 'Server is up and seeding has completed!'
