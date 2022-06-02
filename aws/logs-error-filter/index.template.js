// From https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/SubscriptionFilters.html

var zlib = require('zlib');

exports.handler = function (input, context) {
  var payload = Buffer.from(input.awslogs.data, 'base64');

  zlib.gunzip(payload, function (e, result) {
    if (e) {
      context.fail(e);
    } else {
      result = JSON.parse(result.toString());

      console.log('[APP_NAME] Event Data:', JSON.stringify(result, null, 2));

      context.succeed();
    }
  });
};
