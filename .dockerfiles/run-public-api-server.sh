#!/bin/bash

set -ex

./.dockerfiles/wait-for.sh server:3001

./.dockerfiles/public-api-db-user-setup.sh

yarn run start-api --level debug
