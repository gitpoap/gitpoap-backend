import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { fromIni } from '@aws-sdk/credential-provider-ini';

const environment = process.env.NODE_ENV;
const aws_profile = process.env.AWS_PROFILE;

export const CONTACTS_TABLE_NAME = environment === 'local' ? 'contacts-local' : 'contacts';
export const SUGGESTIONS_TABLE_NAME = environment === 'local' ? 'suggestions-local' : 'suggestions';

const DYNAMO_DB_OPTIONS =
  environment === 'local'
    ? {
        region: 'us-east-2',
        credentials: fromIni({ profile: aws_profile }),
      }
    : {
        region: 'us-east-2',
      };

export const dynamoDB = new DynamoDBClient(DYNAMO_DB_OPTIONS);
