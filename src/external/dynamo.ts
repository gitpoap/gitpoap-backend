import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { NODE_ENV, AWS_PROFILE } from '../environment';

type DynamoConfigProfile = {
  config: DynamoDBClientConfig;
  tables: {
    contact: string;
    suggestions: string;
    intakeForm: string;
  };
};

type DynamoConfigProfiles = Record<'local' | 'prod', DynamoConfigProfile>;

const DYNAMO_CONFIG_PROFILES: DynamoConfigProfiles = {
  local: {
    config: {
      region: 'us-east-2',
      credentials: fromIni({ profile: AWS_PROFILE }),
    },
    tables: {
      contact: 'contact-local',
      suggestions: 'suggestions-local',
      intakeForm: 'intake-form',
    },
  },
  prod: {
    config: {
      region: 'us-east-2',
    },
    tables: {
      contact: 'contact',
      suggestions: 'suggestions',
      intakeForm: 'intake-form',
    },
  },
};

/* Select the correct config profile based on the current environment */
export const configProfile = DYNAMO_CONFIG_PROFILES[NODE_ENV === 'local' ? 'local' : 'prod'];

/* Set table names */
export const CONTACTS_TABLE_NAME = configProfile.tables.contact;
export const SUGGESTIONS_TABLE_NAME = configProfile.tables.suggestions;
export const INTAKE_FORM_TABLE_NAME = configProfile.tables.intakeForm;

/* Create  DynamoDB client */
export const dynamoDBClient = new DynamoDBClient(configProfile.config);
