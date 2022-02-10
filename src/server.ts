require('dotenv').config();

import express from 'express';
import 'reflect-metadata';
import cors from 'cors';
import subscribeRouter from './routes/subscribe';
import { suggestRouter } from './routes/suggest';
import jwtRouter from './routes/jwt';
import { githubRouter } from './routes/github';
import { CONTACTS_TABLE_NAME } from './dynamo';
import { PORT } from './constants';
import { getSchema } from './graphql/schema';
import { context } from './context';
import { graphqlHTTP } from 'express-graphql';

const main = async () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/', (req, res) => {
    res.send('GitPOAP API Server');
  });

  /* Endpoints */
  app.use('/jwt', jwtRouter);
  app.use('/subscribe', subscribeRouter);
  app.use('/suggest', suggestRouter);
  app.use('/github', githubRouter);
  app.use('/graphql', graphqlHTTP({ schema: await getSchema, context, graphiql: true }));

  app.listen(PORT, () => {
    console.log(`The application is listening on port ${PORT}\n`);

    const environment = process.env.NODE_ENV;
    const secret = process.env.JWT_SECRET;
    const aws_profile = process.env.AWS_PROFILE;

    console.log('Environment: ', environment);
    console.log('Secret: ', secret);
    console.log('Contacts table: ', CONTACTS_TABLE_NAME);
    console.log('Using AWS Profile: ', aws_profile);
  });
};

main();
