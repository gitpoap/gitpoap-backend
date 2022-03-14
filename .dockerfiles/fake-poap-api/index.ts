import { DateTime } from 'luxon';
import express from 'express';
import fetch from 'cross-fetch';
import { z } from 'zod';
import * as events from './data';

const app = express();
const port = 4004;

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
      console.log(await authResponse.text());
      return false;
    }

    return true;
  } catch (err) {
    console.log(err);
    return false;
  }
}

const CreateEventSchema = z.object({
  name: z.string(),
  description: z.string(),
  city: z.string(),
  country: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  expiry_date: z.string(),
  year: z.number(),
  event_url: z.string(),
  virtual_event: z.boolean(),
  image: z.string(),
  secret_code: z.string(),
  event_template_id: z.number(),
  email: z.string(),
  requested_codes: z.number(),
  private_event: z.boolean(),
});

app.post('/events', async (req, res) => {
  console.log(`Received POST /events request: ${JSON.stringify(req.body)}`);

  const schemaResult = CreateEventSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  res.setHeader('Content-Type', 'application/json');

  res.end(
    JSON.stringify({
      id: 0,
      fancy_id: 'string',
      name: req.body.name,
      event_url: req.body.event_url,
      image_url: 'string',
      country: req.body.country,
      city: req.body.city,
      description: req.body.description,
      year: req.body.year,
      start_date: req.body.start_date,
      end_date: req.body.end_date,
      expiry_date: req.body.expiry_date,
      created_date: 'string',
      from_admin: true,
      virtual_event: req.body.virtual_date,
      event_template_id: req.body.event_template_id,
      event_host_id: 0,
      private_event: req.body.private_event,
    }),
  );
});

app.get('/actions/scan/:address', async (req, res) => {
  console.log(`Got request to view all POAPs for address: ${req.params.address}`);

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  res.setHeader('Content-Type', 'application/json');

  res.end(
    JSON.stringify([
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
    ]),
  );
});

app.get('/events/id/:id', async (req, res) => {
  console.log(`Got request for information about event ID: ${req.params.id}`);

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  res.setHeader('Content-Type', 'application/json');

  switch (req.params.id) {
    case '1':
      res.end(JSON.stringify(events.event1));
      break;
    case '2':
      res.end(JSON.stringify(events.event2));
      break;
    case '3':
      res.end(JSON.stringify(events.event3));
      break;
    case '27309':
      res.end(JSON.stringify(events.event27309));
      break;
    case '27307':
      res.end(JSON.stringify(events.event27307));
      break;
    case '27305':
      res.end(JSON.stringify(events.event27305));
      break;
    case '25149':
      res.end(JSON.stringify(events.event25149));
      break;
    case '19375':
      res.end(JSON.stringify(events.event19375));
      break;
    case '29009':
      res.end(JSON.stringify(events.event29009));
      break;
    default:
      res.status(404).send(`ID ${req.params.id} NOT FOUND`);
      break;
  }
});

const ClaimQRSchema = z.object({
  address: z.string(),
  qr_hash: z.string(),
  secret: z.string(),
});

let tokenId = 1;

app.post('/actions/claim-qr', async (req, res) => {
  console.log(`Received claim-qr request: ${JSON.stringify(req.body)}`);

  const schemaResult = ClaimQRSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  res.setHeader('Content-Type', 'application/json');

  const today = DateTime.now().toFormat('yyyy-MM-dd');

  res.end(
    JSON.stringify({
      id: (tokenId++).toString(),
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
    }),
  );
});

app.get('/token/:id', async (req, res) => {
  console.log(`Received request for POAP info about ID: ${req.params.id}`);

  if (!(await validateAuth(req))) {
    return res.status(401).send({ msg: 'The token is invalid' });
  }

  res.setHeader('Content-Type', 'application/json');

  res.end(
    JSON.stringify({
      event: events.event27309,
      tokenId: req.params.id,
      owner: '0x206e554084BEeC98e08043397be63C5132Cc01A1',
      chain: 'xdai',
      created: '2022-03-14',
    }),
  );
});

app.listen(port, () => {
  console.log(`Fake POAP API listening on port ${port}`);
});
