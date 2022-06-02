#!/bin/bash

EXE_DIR=$(realpath $(dirname $0))

aws iam create-role \
  --role-name ERROR-log-forwarder-execution-role \
  --assume-role-policy-document $(cat $EXE_DIR/role-policy.json)
