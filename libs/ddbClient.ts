import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { fromIni } from "@aws-sdk/credential-provider-ini";

const environment = process.env.NODE_ENV as string;

const DYNAMO_DB_OPTIONS = environment == "dev" ? {
  region: "us-east-2",
  credentials: fromIni({profile: 'colfax-gitpoap'})
} : {
  region: "us-east-2"
};

const ddbClient =  new DynamoDBClient(DYNAMO_DB_OPTIONS);

export { ddbClient };
