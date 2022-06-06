#!/bin/bash

if [ $# != 1 ]; then
  echo "Missing arguments!"
  echo
  echo "Usage: create-lambda.sh <NamePrefix>"
  echo
  echo "  <NamePrefix> - The name prefix to use for the lambda"
  echo
  exit 1
fi

FUNCTION_NAME="$1-ERROR-log-forwarder"
LOG_GROUP_NAME="$1-server-container"

set -ex

npx tsc --project ./
cp dist/index.template.js index.js
sed -i "s/APP_NAME/$1/g" index.js

zip index.zip index.js

aws lambda create-function \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://index.zip \
    --role arn:aws:iam::510113809275:role/ERROR-log-forwarder-execution-role \
    --handler index.handler \
    --runtime nodejs12.x

aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id $FUNCTION_NAME \
    --principal logs.us-east-2.amazonaws.com \
    --action lambda:InvokeFunction \
    --source-arn "arn:aws:logs:us-east-2:510113809275:log-group:$LOG_GROUP_NAME:*" \
    --source-account 510113809275

aws logs put-subscription-filter \
    --log-group-name $LOG_GROUP_NAME \
    --filter-name "$1-ERROR-filter" \
    --filter-pattern ERROR \
    --destination-arn "arn:aws:lambda:us-east-2:510113809275:function:$FUNCTION_NAME"
