import { PutItemCommand } from '@aws-sdk/client-dynamodb';
import { Router } from 'express';
import { dynamoDBClient, SUGGESTIONS_TABLE_NAME } from '../external/dynamo';
import { getRequestLogger } from '../middleware/loggingAndTiming';
import { jwtBasic } from '../middleware/auth';

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

suggestRouter.post('/', jwtBasic, async function (req, res) {
  const logger = getRequestLogger(req);

  if (!req.user) {
    logger.warn('Token is invalid');
    return res.sendStatus(401);
  } else {
    logger.info(`Request from ${req.body.email} to make a suggestion`);

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
    try {
      await dynamoDBClient.send(new PutItemCommand(params));
    } catch (err) {
      logger.warn(`Got error from dynamo DB send: ${err}`);
    }

    logger.debug(`Completed request from ${req.body.email} to make a suggestion`);

    res.sendStatus(200);
  }
});
