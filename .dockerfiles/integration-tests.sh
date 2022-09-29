#!/bin/bash

set -ex

./.dockerfiles/wait-for.sh server:3001

yarn heat-up-ens-cache

./.dockerfiles/wait-for.sh public-api-server:3122

npx jest --verbose --setupFiles dotenv/config --testPathPattern '/integration/' --runInBand
