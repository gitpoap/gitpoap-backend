#!/bin/bash

set -ex

./.dockerfiles/wait-for-server.sh

npx jest --setupFiles dotenv/config --testPathPattern '/integration/' --runInBand
