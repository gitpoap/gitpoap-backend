#!/bin/bash

set -e

source ./.env

redis_cmd() {
  redis-cli --no-auth-warning -u $REDIS_URL "$@"
}

for key in $(redis_cmd KEYS "$1*"); do
  VALUE=$(redis_cmd GET $key)

  echo "$key  ->  $VALUE"
done
