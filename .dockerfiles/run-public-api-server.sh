#!/bin/bash

set -ex

./.dockerfiles/wait-for-server.sh

./.dockerfiles/readonly-db-setup.sh

yarn run start-api
