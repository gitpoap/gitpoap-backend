import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { Router } from "express";
import jwt from "express-jwt";
import { ddbClient, SUGGESTIONS_TABLE_NAME } from "../libs/ddbClient";

type SuggestionFormData = {
  email: string;
  repoUrl: string;
  userType: UserType;
};

enum UserType {
  Contributor = "Contributor",
  Owner = "Owner",
}

export const suggestRouter = Router();

suggestRouter.post(
  "/",
  jwt({ secret: process.env.JWT_SECRET as string, algorithms: ["HS256"] }),
  async function (req, res) {
    if (!req.user) {
      // Not authenticated

      console.log("Repo suggested by unauthenticated user.");

      return res.sendStatus(401);
    } else {
      const body = req.body as SuggestionFormData;

      // Authenticated
      console.log("Suggestions repo with url: " + body.repoUrl);

      const params = {
        TableName: SUGGESTIONS_TABLE_NAME,
        Item: {
          email: { S: body.email },
          repo_url: { S: body.repoUrl },
          user_type: { S: body.userType },
          timestamp: { S: new Date().toISOString() },
        },
      };

      // do the stuff
      const response = await ddbClient.send(new PutItemCommand(params));
      console.log(response);

      res.sendStatus(200);
    }
  }
);
