#!/bin/bash

set -ex

./.dockerfiles/wait-for-server.sh

# sleep so that background processes finish
sleep 5

npx jest --setupFiles dotenv/config --testPathPattern '/integration/' --runInBand
