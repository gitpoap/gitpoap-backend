import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { fromIni } from "@aws-sdk/credential-provider-ini";

const environment = process.env.NODE_ENV as string;
const aws_profile = process.env.AWS_PROFILE as string;

export const CONTACTS_TABLE_NAME =
  environment == "local" ? "contacts-local" : "contacts";

export const SUGGESTIONS_TABLE_NAME =
  environment === "local" ? "suggestions-local" : "suggestions";

const DYNAMO_DB_OPTIONS =
  environment == "local"
    ? {
        region: "us-east-2",
        credentials: fromIni({ profile: aws_profile }),
      }
    : {
        region: "us-east-2",
      };

export const ddbClient = new DynamoDBClient(DYNAMO_DB_OPTIONS);

// set up aws cli
// create ~/.aws/credentials
// can add different access keys - default or named
