// From:
// * https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/SubscriptionFilters.html
// * https://stackoverflow.com/a/31485168/18750275

var aws = require('aws-sdk');
var zlib = require('zlib');

function transformLogEvent(logEvent) {
  return {
    timestamp: new Date(logEvent.timestamp).toISOString(),
    message: logEvent.message,
  };
}

exports.handler = function (input, context) {
  var payload = Buffer.from(input.awslogs.data, 'base64');

  zlib.gunzip(payload, function (e, result) {
    if (e) {
      context.fail(e);
    } else {
      var eventData = JSON.parse(result.toString());

      console.log('[APP_NAME] Event Data:', eventData);

      var sns = new aws.SNS();

      var params = {
        TopicArn: 'arn:aws:sns:us-east-2:510113809275:gitpoap-backend-error-notification-topic',
        Subject: '[APP_NAME]: ERROR!',
        Message: JSON.stringify(
          {
            origin: 'APP_NAME',
            logEvents: eventData.logEvents.map(transformLogEvent),
          },
          null,
          2,
        ),
      };

      sns.publish(params, context.done);
    }
  });
};
