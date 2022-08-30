import { DateTime } from 'luxon';
import express from 'express';
import fetch from 'cross-fetch';
import { z } from 'zod';
import * as events from './src/data';
import { POAPEvent } from './src/types/poap';
import winston from 'winston';
import multer from 'multer';
import { extname } from 'path';
import short from 'short-uuid';
import { ADDRESSES } from './constants';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} [fake-poap-api] ${level}: ${message}`;
    }),
  ),
  transports: [new winston.transports.Console()],
  exceptionHandlers: [new winston.transports.Console()],
  rejectionHandlers: [new winston.transports.Console()],
});

const app = express();
const port = 4004;

const UPLOAD_FOLDER = <string>process.env.UPLOAD_FOLDER;
app.use('/public', express.static(UPLOAD_FOLDER));

let eventsCache: Record<string, any> = {
  1: events.event1,
  2: events.event2,
  3: events.event3,
  27309: events.event27309,
  27307: events.event27307,
  27305: events.event27305,
  25149: events.event25149,
  19375: events.event19375,
  29009: events.event29009,
  34634: events.event34634,
  36568: events.event36568,
  36569: events.event36569,
  36570: events.event36570,
  36571: events.event36571,
  36572: events.event36572,
  36573: events.event36573,
  36574: events.event36574,
  36575: events.event36575,
  36576: events.event36576,
  37428: events.event37428,
  37429: events.event37429,
  37430: events.event37430,
};
let nextEventId = 900000;

let tokensCache: Record<string, any> = {
  thunderdome: {          // Claim ID 1
    event: events.event1, // GitPOAP ID 1
    owner: ADDRESSES.test1,
    tokenId: 'thunderdome',
    chain: 'xdai',
    created: '2022-03-13',
  },
  4068606: {              // Claim ID 2
    event: events.event1, // GitPOAP ID 1
    owner: ADDRESSES.jay,
    tokenId: '4068606',
    chain: 'xdai',
    created: '2022-03-14',
  },
  ethdenver: {            // Claim ID 4
    event: events.event2, // GitPOAP ID 2
    owner: ADDRESSES.test1,
    tokenId: 'ethdenver',
    chain: 'xdai',
    created: '2022-03-14',
  },
  4078452: {              // Claim ID 5
    event: events.event2, // GitPOAP ID 2
    owner: ADDRESSES.jay,
    tokenId: '4078452',
    chain: 'xdai',
    created: '2022-03-14',
  },
  'pizza-pie': {          // Claim ID 8
    event: events.event3, // GitPOAP ID 3
    owner: ADDRESSES.burz,
    tokenId: 'pizza-pie',
    chain: 'xdai',
    created: '2022-03-14',
  },
  4082459: {              // Claim ID 9
    event: events.event3, // GitPOAP ID 3
    owner: ADDRESSES.jay,
    tokenId: '4082459',
    chain: 'xdai',
    created: '2022-03-14',
  },
  3217451: {                  // Claim ID 14
    event: events.event19375, // GitPOAP ID 4
    owner: ADDRESSES.jay,
    tokenId: '3217451',
    chain: 'xdai',
    created: '2022-03-14',
  },
  3973554: {                  // Claim ID 16
    event: events.event29009, // GitPOAP ID 5
    owner: ADDRESSES.burz,
    tokenId: '3973554',
    chain: 'xdai',
    created: '2022-03-14',
  },
  4126448: {                  // Claim ID 17
    event: events.event29009, // GitPOAP ID 5
    owner: ADDRESSES.colfax,
    tokenId: '4126448',
    chain: 'xdai',
    created: '2022-03-14',
  },
  123456789: {                // Claim ID 21
    event: events.event29009, // GitPOAP ID 5
    owner: ADDRESSES.burz2,
    tokenId: '123456789',
    chain: 'xdai',
    created: '2022-03-14',
  },
  1234567891: {               // Claim ID 9B
    event: events.event36570, // GitPOAP ID 9
    owner: ADDRESSES.burz,
    tokenId: '1234567891',
    chain: 'xdai',
    created: '2022-03-14',
  },
  1234567892: {               // Claim ID 9C
    event: events.event36570, // GitPOAP ID 9
    owner: ADDRESSES.colfax,
    tokenId: '1234567892',
    chain: 'xdai',
    created: '2022-03-14',
  },
  1234567893: {               // Claim ID 10C
    event: events.event36571, // GitPOAP ID 10
    owner: ADDRESSES.colfax,
    tokenId: '1234567893',
    chain: 'xdai',
    created: '2022-03-14',
  },

  // Non claims
  4068504: {
    event: events.event27307, // you've met jay
    owner: ADDRESSES.jay,
    tokenId: '4068504',
    chain: 'xdai',
    created: '2022-03-14',
  },
  77777: {
    event: events.event36576,
    owner: ADDRESSES.burz,
    tokenId: '77777',
    chain: 'xdai',
    created: '2019-12-11',
  },
  77778: {
    event: events.event36576,
    owner: ADDRESSES.kayleen,
    tokenId: '77778',
    chain: 'xdai',
    created: '2019-12-11',
  },
};
let nextTokenId = 100000000;

let qrHashMap: Record<string, { tokenId: number; minted: DateTime }> = {};

app.use(express.json());

async function validateAuth(req: express.Request) {
  const authorization = req.get('Authorization');
  if (!authorization) {
    return false;
  }

  if (authorization.substr(0, 7) !== 'Bearer ') {
    return false;
  }

  const token = authorization.substr(7);

  try {
    const authResponse = await fetch(`http://fake-poap-auth:4005/validate/${token}`);

    if (authResponse.status >= 400) {
      logger.error(`Failed to validate auth token: ${await authResponse.text()}`);
      return false;
    }

    return true;
  } catch (err) {
    logger.error(`Failed to validate auth token: ${err}`);
    return false;
  }
}

// Everything is a string since it's from multipart
const CreateEventSchema = z.object({
  name: z.string(),
  description: z.string(),
  city: z.string(),
  country: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  expiry_date: z.string(),
  year: z.string(),
  event_url: z.string(),
  virtual_event: z.string(),
  secret_code: z.string(),
  event_template_id: z.string(),
  email: z.string(),
  requested_codes: z.string(),
  private_event: z.string(),
});

const storage = multer.diskStorage({
  destination: UPLOAD_FOLDER,
  filename: (req, file, cb) => {
    return cb(null, Date.now() + extname(file.originalname));
  },
});
const upload = multer({ storage });

app.post('/events', upload.single('image'), async (req, res) => {
  logger.info('Received POST /events request');

  const schemaResult = CreateEventSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }
  if (!req.file) {
    return res.status(400).send({ msg: 'Missing image field' });
  }

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  const eventId = nextEventId++;

  const event = {
    id: eventId,
    fancy_id: 'string',
    name: req.body.name,
    event_url: req.body.event_url,
    image_url: `http://localhost:4004/public/${req.file.filename}`,
    country: req.body.country,
    city: req.body.city,
    description: req.body.description,
    year: parseInt(req.body.year, 10),
    start_date: req.body.start_date,
    end_date: req.body.end_date,
    expiry_date: req.body.expiry_date,
    created_date: DateTime.now().toFormat('yyyy-MM-dd'),
    from_admin: false,
    virtual_event: req.body.virtual_date === 'true',
    event_template_id: parseInt(req.body.event_template_id, 10),
    event_host_id: 0,
    private_event: req.body.private_event === 'true',
  };

  res.setHeader('Content-Type', 'application/json');

  eventsCache[eventId.toString()] = event;

  res.end(JSON.stringify(event));
});

app.get('/actions/scan/:address', async (req, res) => {
  logger.info(`Received GET /actions/scan/${req.params.address} request`);

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  res.setHeader('Content-Type', 'application/json');

  let tokens = [
    {
      event: events.event1,
      tokenId: 'thunderdome',
      owner: req.params.address,
      chain: 'xdai',
      created: '2022-02-02',
    },
    {
      event: events.event2,
      tokenId: 'ethdenver',
      owner: req.params.address,
      chain: 'xdai',
      created: '2022-02-01',
    },
    {
      event: events.event3,
      tokenId: 'pizza-pie',
      owner: req.params.address,
      chain: 'xdai',
      created: '2022-03-01',
    },
    {
      event: events.event27309,
      tokenId: '4082459',
      owner: req.params.address,
      chain: 'xdai',
      created: '2022-02-01',
    },
    {
      event: events.event27307,
      tokenId: '4068504',
      owner: req.params.address,
      chain: 'xdai',
      created: '2022-02-01',
    },
    {
      event: events.event27305,
      tokenId: '4068606',
      owner: req.params.address,
      chain: 'xdai',
      created: '2022-02-03',
    },
    {
      event: events.event25149,
      tokenId: '4078452',
      owner: req.params.address,
      chain: 'xdai',
      created: '2022-02-02',
    },
  ];

  // Special case for Kayleen's deprecated GitPOAP
  if (req.params.address.toLowerCase() === ADDRESSES.kayleen) {
    return res.end(JSON.stringify([tokensCache['77778']]));
  }

  res.end(JSON.stringify(tokens));
});

app.get('/events/id/:id', async (req, res) => {
  logger.info(`Received a GET /events/id/${req.params.id} request`);

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  res.setHeader('Content-Type', 'application/json');

  if (req.params.id in eventsCache) {
    res.end(JSON.stringify(eventsCache[req.params.id]));
  } else {
    res.status(404).send(`ID ${req.params.id} NOT FOUND`);
  }
});

const ClaimQRSchema = z.object({
  address: z.string(),
  qr_hash: z.string(),
  secret: z.string(),
});

app.get('/actions/claim-qr', async (req, res) => {
  logger.info(`Received a GET /actions/claim-qr request with query: ${JSON.stringify(req.query)}`);

  res.setHeader('Content-Type', 'application/json');

  if (req.query.qr_hash === undefined) {
    return res.status(400).send({ msg: 'Missing "qr_hash" param' });
  }

  const data: Record<string, any> = {
    id: 12328325,
    qr_hash: req.query.qr_hash,
    tx_hash: '0xf43a6db2e1cc16480180376bd6a245b8e705021eec67bb684b08cf0981be968a',
    event_id: 1,
    beneficiary: '0xD8f20eE2E12bA1599bf8389909760277aeDd26F1',
    user_input: '0xD8f20eE2E12bA1599bf8389909760277aeDd26F1',
    signer: '0xC87ea77298b3e82F3c36Fb42b1624300d8A1D649',
    claimed: true,
    claimed_date: '2022-04-01T17:48:40.161Z',
    created_date: '2022-03-31T21:22:30.860Z',
    is_active: true,
    secret: '4ce3b20148b98df65b5c6e2db89ce9eb4f5802b81b86cea651b9c1b853d3fd25',
    event: events.event1,
    event_template: null,
    tx_status: 'pending',
    delegated_mint: false,
    delegated_signed_message: '',
    result: null,
  };

  if ((req.query.qr_hash as string) in qrHashMap) {
    const info = qrHashMap[req.query.qr_hash as string];

    // We can mark complete after 15 seconds
    if (info.minted.plus({ seconds: 15 }) < DateTime.now()) {
      data.tx_status = 'passed';
      data.result = { token: info.tokenId };
    }
  }

  res.end(JSON.stringify(data));
});

app.post('/actions/claim-qr', async (req, res) => {
  logger.info('Received POST /actions/claim-qr request');

  const schemaResult = ClaimQRSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  res.setHeader('Content-Type', 'application/json');

  const today = DateTime.now().toFormat('yyyy-MM-dd');

  const token = {
    // Add a constant that frontend can't figure out
    id: 700000 + nextTokenId,
    qr_hash: req.body.qr_hash,
    queue_uid: 'string',
    event_id: 1,
    beneficiary: req.body.address,
    user_input: 'string',
    signer: 'burz.eth',
    claimed: true,
    claimed_date: today,
    created_date: today,
    is_active: true,
    event: events.event1,
    delegated_mint: true,
    delegated_signed_message: 'string',
  };

  tokensCache[nextTokenId] = token;

  qrHashMap[req.body.qr_hash] = { tokenId: nextTokenId, minted: DateTime.now() };

  ++nextTokenId;

  res.end(JSON.stringify(token));
});

app.get('/token/:id', async (req, res) => {
  logger.info(`Received a GET /token/${req.params.id} request`);

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  res.setHeader('Content-Type', 'application/json');

  if (req.params.id in tokensCache) {
    res.end(JSON.stringify(tokensCache[req.params.id]));
  } else {
    // default
    res.end(
      JSON.stringify({
        event: events.event29009,
        tokenId: req.params.id,
        owner: '0x206e554084BEeC98e08043397be63C5132Cc01A1',
        chain: 'xdai',
        created: '2022-03-14',
      }),
    );
  }
});

const RedeemRequestsSchema = z.object({
  event_id: z.number(),
  requested_codes: z.number(),
  secret_code: z.string(),
  redeem_type: z.string(),
});

app.post('/redeem-requests', async (req, res) => {
  logger.info('Received POST /redeem-requests request');

  const schemaResult = RedeemRequestsSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  return res.status(200).send('324324');
});

const GetEventCodesSchema = z.object({
  secret_code: z.string(),
});

function generateFakeQRCodes() {
  let codes = [];

  const generator = short();

  for (let i = 0; i < 50; ++i) {
    codes.push({
      qr_hash: generator.new().slice(0, 6),
      claimed: Math.random() < 0.5,
    });
  }

  return codes;
}

app.post('/event/:id/qr-codes', async (req, res) => {
  logger.info('Received POST /event/:id/qr-codes request');

  const schemaResult = GetEventCodesSchema.safeParse(req.body);
  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  // Note: Assume that the secret_code is correct for the event

  return res.status(200).send(generateFakeQRCodes());
});

app.listen(port, () => {
  logger.info(`fake-poap-api listening on port ${port}`);
});
