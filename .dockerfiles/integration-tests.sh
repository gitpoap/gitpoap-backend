#!/bin/bash

set -ex

# Wait for seeding to complete (the server port becomes available)
while ! curl -f server:3001; do sleep 10; done

echo 'Server is up and seeding has completed!'

npx jest --setupFiles dotenv/config --testPathPattern '/integration/'
