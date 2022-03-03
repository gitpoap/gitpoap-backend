const express = require('express');
const app = express();
const port = 4004;
const z = require('zod');
const data = require('./data');

app.use(express.json());

const AddEventSchema = z.object({
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

app.post('/events', (req, res) => {
  console.log(`Received POST /events request: ${JSON.stringify(req.body)}`);

  const schemaResult = AddEventSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
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

app.get('/actions/scan/:address', (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  res.end(
    JSON.stringify([
      {
        event: data.event1,
        tokenId: 'thunderdome',
        owner: req.params.address,
        chain: 'xdai',
        created: '2022-02-02',
      },
      {
        event: data.event2,
        tokenId: 'ethdenver',
        owner: req.params.address,
        chain: 'xdai',
        created: '2022-02-01',
      },
    ]),
  );
});

app.get('/events/id/:id', (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  switch (req.params.id) {
    case '1':
      res.end(JSON.stringify(data.event1));
      break;
    case '2':
      res.end(JSON.stringify(data.event2));
      break;
    default:
      res.status(404).send(`ID ${req.params.id} NOT FOUND`);
      break;
  }
});

app.listen(port, () => {
  console.log(`Fake POAP API listening on port ${port}`);
});
