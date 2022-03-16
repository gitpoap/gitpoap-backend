import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { NODE_ENV, AWS_PROFILE } from './environment';

export const CONTACTS_TABLE_NAME = NODE_ENV === 'local' ? 'contacts-local' : 'contacts';
export const SUGGESTIONS_TABLE_NAME = NODE_ENV === 'local' ? 'suggestions-local' : 'suggestions';

const DYNAMO_DB_OPTIONS =
  NODE_ENV === 'local'
    ? {
        region: 'us-east-2',
        credentials: fromIni({ profile: AWS_PROFILE }),
      }
    : {
        region: 'us-east-2',
      };

export const dynamoDB = new DynamoDBClient(DYNAMO_DB_OPTIONS);
