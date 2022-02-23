const express = require('express');
const app = express();
const port = 4004;

app.use(express.json());

app.post('/events', (req, res) => {
  console.log(`Received POST /events request: ${JSON.stringify(req.body)}`);

  /*
   * Expected request:
   * {
   *   "name": "string",
   *   "description": "string",
   *   "city": "string",
   *   "country": "string",
   *   "start_date": "string",
   *   "end_date": "string",
   *   "expiry_date": "string",
   *   "year": 0,
   *   "event_url": "string",
   *   "virtual_event": true,
   *   "image": "string",
   *   "secret_code": "string",
   *   "event_template_id": 0,
   *   "email": "string",
   *   "requested_codes": 0,
   *   "private_event": false
   * }
   */
  if (!req.body?.name) {
    res.status(400).send('Missing "name" field');
  } else if (!req.body?.description) {
    res.status(400).send('Missing "description" field');
  } else if (!req.body?.city) {
    res.status(400).send('Missing "city" field');
  } else if (!req.body?.country) {
    res.status(400).send('Missing "country" field');
  } else if (!req.body?.start_date) {
    res.status(400).send('Missing "start_date" field');
  } else if (!req.body?.end_date) {
    res.status(400).send('Missing "end_date" field');
  } else if (!req.body?.expiry_date) {
    res.status(400).send('Missing "expiry_date" field');
  } else if (!req.body.hasOwnProperty('year')) {
    res.status(400).send('Missing "year" field');
  } else if (!req.body?.event_url) {
    res.status(400).send('Missing "event_url" field');
  } else if (!req.body?.virtual_event) {
    res.status(400).send('Missing "virtual_event" field');
  } else if (!req.body?.image) {
    res.status(400).send('Missing "image" field');
  } else if (!req.body?.secret_code) {
    res.status(400).send('Missing "secret_code" field');
  } else if (!req.body.hasOwnProperty('event_template_id')) {
    res.status(400).send('Missing "event_template_id" field');
  } else if (!req.body?.email) {
    res.status(400).send('Missing "email" field');
  } else if (!req.body.hasOwnProperty('requested_codes')) {
    res.status(400).send('Missing "requested_codes" field');
  } else if (!req.body.hasOwnProperty('private_event')) {
    res.status(400).send('Missing "private_event" field');
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      "id": 0,
      "fancy_id": "string",
      "name": req.body.name,
      "event_url": req.body.event_url,
      "image_url": "string",
      "country": req.body.country,
      "city": req.body.city,
      "description": req.body.description,
      "year": req.body.year,
      "start_date": req.body.start_date,
      "end_date": req.body.end_date,
      "expiry_date": req.body.expiry_date,
      "created_date": "string",
      "from_admin": true,
      "virtual_event": req.body.virtual_date,
      "event_template_id": req.body.event_template_id,
      "event_host_id": 0,
      "private_event": req.body.private_event
    }));
  }
});

app.listen(port, () => {
  console.log(`Fake POAP API listening on port ${port}`);
});
