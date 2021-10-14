import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { fromIni } from "@aws-sdk/credential-provider-ini";

const ddbClient = new DynamoDBClient({
  region: "us-east-2",
  credentials: fromIni({profile: 'colfax-gitpoap'})
});

export { ddbClient };