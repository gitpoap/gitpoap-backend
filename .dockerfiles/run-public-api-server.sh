#!/bin/bash

set -ex

./wait-for-it.sh -t 0 server:3001

./.dockerfiles/public-api-db-user-setup.sh

yarn run start-api --level debug
