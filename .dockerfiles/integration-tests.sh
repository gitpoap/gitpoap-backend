#!/bin/bash

set -ex

./wait-for-it.sh -t 0 server:3001
./wait-for-it.sh -t 0 public-api-server:3122

npx jest --verbose --setupFiles dotenv/config --testPathPattern '/integration/' --runInBand
