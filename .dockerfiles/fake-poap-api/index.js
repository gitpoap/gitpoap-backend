const express = require('express');
const app = express();
const port = 4004;
const z = require('zod');

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
        event: {
          id: 1,
          fancy_id: 'welcome-to-the-thunderdome',
          name: 'Welcome to the Thunderdome',
          event_url: 'https://thunderdome.xyz',
          image_url: 'https://avatars.githubusercontent.com/u/1555326?v=4',
          country: '',
          city: '',
          description: 'Wow, you survived.\nGreat',
          year: 2022,
          start_date: '2022-02-02',
          end_date: '2026-02-02',
          expiry_date: '2092-12-11',
          supply: '10',
        },
        tokenId: 'thunderdome',
        owner: req.params.address,
        chain: 'xdai',
        created: '2022-02-02',
      },
      {
        event: {
          id: 2,
          fancy_id: 'ethdenver',
          name: 'ethdenver',
          event_url: 'https://eth.denver',
          image_url: 'https://avatars.githubusercontent.com/u/1455326?v=4',
          country: '',
          city: '',
          description: '#eth #denver #2022',
          year: 2022,
          start_date: '2022-02-11',
          end_date: '2022-02-23',
          expiry_date: '2022-03-28',
          supply: '20',
        },
        tokenId: 'ethdenver',
        owner: req.params.address,
        chain: 'xdai',
        created: '2022-02-01',
      },
    ]),
  );
});

app.listen(port, () => {
  console.log(`Fake POAP API listening on port ${port}`);
});
