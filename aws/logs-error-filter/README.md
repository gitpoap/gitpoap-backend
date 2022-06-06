# logs-error-filter

This folder contains scripts and the code for setting up a ERROR log forwarder for
the GitPOAP backends.

References:
* [Creating Lambda Execution Role](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-awscli.html#with-userapp-walkthrough-custom-events-create-iam-role)
* [Subscription Filters With AWS Lambda](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/SubscriptionFilters.html#LambdaFunctionExample)

## Testing

Example of how to send a test event:

```sh
aws logs put-log-events \
  --log-group-name gitpoap-backend-staging-server-container \
  --log-stream-name "gitpoap-backend-staging-server/gitpoap-backend-staging-server/5a588ba689944e2f8f3051ece493f360" \
  --log-events '[{"timestamp":1654206260325 , "message": "ERROR: testing new error forwarder"}]' \
  --sequence-token 49630032679309044154678469222272658516769237287999374034
```

*Note:* The sequence token will be incorrect, just copy the expected one that it prints out and rerun.
