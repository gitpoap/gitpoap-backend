import { PutItemCommand } from '@aws-sdk/client-dynamodb';
import { Router } from 'express';
import jwt from 'express-jwt';
import { dynamoDB, SUGGESTIONS_TABLE_NAME } from '../dynamo';
import { JWT_SECRET } from '../environment';

type SuggestionFormData = {
  email: string;
  repoUrl: string;
  userType: UserType;
};

enum UserType {
  Contributor = 'Contributor',
  Owner = 'Owner',
}

export const suggestRouter = Router();

suggestRouter.post(
  '/',
  jwt({ secret: JWT_SECRET as string, algorithms: ['HS256'] }),
  async function (req, res) {
    if (!req.user) {
      return res.sendStatus(401);
    } else {
      const body = req.body as SuggestionFormData;
      const params = {
        TableName: SUGGESTIONS_TABLE_NAME,
        Item: {
          email: { S: body.email },
          repo_url: { S: body.repoUrl },
          user_type: { S: body.userType },
          timestamp: { S: new Date().toISOString() },
        },
      };
      await dynamoDB.send(new PutItemCommand(params));

      res.sendStatus(200);
    }
  },
);
