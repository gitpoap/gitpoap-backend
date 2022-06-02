// From:
// * https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/SubscriptionFilters.html
// * https://stackoverflow.com/a/31485168/18750275

var aws = require('aws-sdk');
var zlib = require('zlib');

exports.handler = function (input, context) {
  var payload = Buffer.from(input.awslogs.data, 'base64');

  zlib.gunzip(payload, function (e, result) {
    if (e) {
      context.fail(e);
    } else {
      var eventData = JSON.stringify(JSON.parse(result.toString()), null, 2);

      console.log('[APP_NAME] Event Data:', eventData);

      var sns = new aws.SNS();

      var params = {
        TopicArn: 'arn:aws:sns:us-east-2:510113809275:gitpoap-backend-error-notification-topic',
        Subject: '[APP_NAME]: ERROR!',
        Message: eventData,
      };

      sns.publish(params, context.done);
    }
  });
};
