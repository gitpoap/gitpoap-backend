import express from 'express';
import { z } from 'zod';
import { v4 } from 'uuid';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} [fake-poap-auth] ${level}: ${message}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});

const app = express();
const port = 4005;

app.use(express.json());

const TokenRequestSchema = z.object({
  audience: z.string(),
  grant_type: z.string(),
  client_id: z.string(),
  client_secret: z.string(),
});

const access_token = v4();

app.post('/oauth/token', (req, res) => {
  logger.info('Received a request for an OAuth Token');

  const schemaResult = TokenRequestSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  if (req.body.audience !== 'gitpoap') {
    return res.status(400).send({ msg: 'Expected "audience" field to contain "gitpoap"' });
  }
  if (req.body.grant_type !== 'client_credentials') {
    return res
      .status(400)
      .send({ msg: 'Expected "grant_type" field to contain "client_credentials"' });
  }
  if (req.body.client_id !== process.env.POAP_CLIENT_ID) {
    return res
      .status(400)
      .send({ msg: 'Expected "client_id" field to contain GitPOAP\'s client ID' });
  }
  if (req.body.client_secret !== process.env.POAP_CLIENT_SECRET) {
    return res
      .status(400)
      .send({ msg: 'Expected "client_secret" field to contain GitPOAP\'s client secret' });
  }

  res.setHeader('Content-Type', 'application/json');

  return res.status(200).send({ access_token });
});

app.get('/validate/:token', (req, res) => {
  logger.info('Received a request to validate an OAuth Token');

  if (req.params.token === access_token) {
    return res.status(200).send('OK');
  } else {
    return res.status(400).send('NAUGHTY');
  }
});

app.listen(port, () => {
  logger.info(`fake-poap-auth server listening on port ${port}`);
});
