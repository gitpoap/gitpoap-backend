import { PutItemCommand } from '@aws-sdk/client-dynamodb';
import { Router } from 'express';
import jwt from 'express-jwt';
import { dynamoDB, CONTACTS_TABLE_NAME } from '../dynamo';

var router = Router();

router.post(
  '/',
  jwt({ secret: process.env.JWT_SECRET as string, algorithms: ['HS256'] }),
  async function (req, res) {
    if (!req.user) {
      return res.sendStatus(401);
    } else {
      const params = {
        TableName: CONTACTS_TABLE_NAME,
        Item: {
          email: { S: req.body.email },
          timestamp: { S: new Date().toISOString() },
        },
      };
      await dynamoDB.send(new PutItemCommand(params));

      res.sendStatus(200);
    }
  },
);

export default router;
