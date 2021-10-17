import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { Router } from "express";
import jwt from "express-jwt";
import { ddbClient, CONTACTS_TABLE_NAME } from "../libs/ddbClient";

var router = Router();

router.post('/', jwt({ secret: process.env.JWT_SECRET as string, algorithms: ['HS256'] }),
  async function(req, res) {
    if (!req.user) {
      // Not authenticated

      console.log("Signup requested from unauthenticated user.");

      return res.sendStatus(401);
    } else {
      // Authenticated
      console.log("Signing up user with email: " + req.body.email);

      const params = {
        TableName: CONTACTS_TABLE_NAME,
        Item: {
          email: { S: req.body.email },
          timestamp: { S: new Date().toISOString() }
        },
      };

      // do the stuff
      const response = await ddbClient.send(new PutItemCommand(params));
      console.log(response);
  
      res.sendStatus(200);
    }
  });

export default router;
