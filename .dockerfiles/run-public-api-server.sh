#!/bin/bash

set -ex

./.dockerfiles/wait-for.sh server:3001

./.dockerfiles/readonly-db-setup.sh

yarn run start-api --level debug
