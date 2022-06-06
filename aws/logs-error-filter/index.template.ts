// From:
// * https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/SubscriptionFilters.html
// * https://stackoverflow.com/a/31485168/18750275

import { SNS } from 'aws-sdk';
import {
  CloudWatchLogsDecodedData,
  CloudWatchLogsEvent,
  CloudWatchLogsLogEvent,
  Context,
} from 'aws-lambda';
import zlib from 'zlib';

function transformLogEvent(logEvent: CloudWatchLogsLogEvent) {
  return {
    timestamp: new Date(logEvent.timestamp).toISOString(),
    message: logEvent.message,
  };
}

export function handler(input: CloudWatchLogsEvent, context: Context) {
  var payload = Buffer.from(input.awslogs.data, 'base64');

  zlib.gunzip(payload, function (e, result) {
    if (e) {
      context.fail(e);
    } else {
      var eventData: CloudWatchLogsDecodedData = JSON.parse(result.toString());

      console.log('[APP_NAME] Event Data:', eventData);

      var sns = new SNS();

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
}
