import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { fromIni } from "@aws-sdk/credential-provider-ini";

const environment = process.env.NODE_ENV as string;

export const CONTACTS_TABLE_NAME = environment == "local" ?
  "contacts-local" : "contacts";

export const SUGGESTIONS_TABLE_NAME = environment === "local" ?
  "suggestions-local" : "suggestions";

const DYNAMO_DB_OPTIONS = environment == "local" ? {
  region: "us-east-2",
  credentials: fromIni({profile: 'colfax-gitpoap'})
} : {
  region: "us-east-2"
};

export const ddbClient =  new DynamoDBClient(DYNAMO_DB_OPTIONS);
