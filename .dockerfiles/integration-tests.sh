#!/bin/bash

set -ex

./.dockerfiles/wait-for.sh server:3001
./.dockerfiles/wait-for.sh public-api-server:3122

npx jest --setupFiles dotenv/config --testPathPattern '/integration/' --runInBand
