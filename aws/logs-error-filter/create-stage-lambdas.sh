#!/bin/bash

EXE_DIR=$(realpath $(dirname $0))

print_usage() {
  echo
  echo "Usage: create-staged-lambdas.sh <Stage>"
  echo
  echo "  <Stage> - Either 'staging' or 'production'"
  echo
}

if [ $# != 1 ]; then
  echo "Missing required arguments!"
  print_usage
  exit 1
fi

if [ "$1" = "staging" ]; then
  BACKEND=gitpoap-backend
  PUBLIC_API=gitpoap-public-api
elif [ "$1" = "production" ]; then
  BACKEND=gitpoap-backend-staging
  PUBLIC_API=gitpoap-public-api-staging
else
  echo "<Stage> must be either 'staging' or 'production'"
  print_usage
  exit 2
fi

set -ex

$EXE_DIR/create-lambda.sh $BACKEND
$EXE_DIR/create-lambda.sh $PUBLIC_API
