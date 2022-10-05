import { Router } from 'express';
import { DateTime } from 'luxon';

import { context } from '../context';
import { sendVerificationEmail } from '../external/postmark';
import { generateUniqueEmailToken } from '../lib/email';
import { resolveENS } from '../lib/ens';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import { AddEmailSchema, RemoveEmailSchema, ValidateEmailSchema } from '../schemas/email';
import { isSignatureValid } from '../signatures';

export const emailRouter = Router();

emailRouter.post('/', async function (req, res) {
  const logger = createScopedLogger('POST /email');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('POST', '/email');

  const schemaResult = AddEmailSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  /* BEGIN: Will be removed following address updates */
  // Resolve ENS if provided
  const resolvedAddress = await resolveENS(req.body.address);
  if (resolvedAddress === null) {
    logger.warn('Request address is invalid');
    endTimer({ status: 400 });
    return res.status(400).send({ msg: `${req.body.address} is not a valid address` });
  }

  if (
    !isSignatureValid(resolvedAddress, 'POST /email', req.body.signature, {
      emailAddress: req.body.emailAddress,
    })
  ) {
    logger.warn('Request signature is invalid');
    endTimer({ status: 401 });
    return res.status(401).send({ msg: 'The signature is not valid for this address and data' });
  }

  const address = await context.prisma.address.findUnique({
    where: { ethAddress: req.body.address.toLowerCase() },
  });
  if (address === null) {
    logger.warn('Request address is invalid');
    endTimer({ status: 400 });
    return res.status(400).send({ msg: `${req.body.address} is not a valid address` });
  }
  /* END: Will be removed following address updates */

  const { emailAddress } = req.body;

  logger.info(`Request from ${req.body.address} to connect email: ${emailAddress}`);

  // Generate a new token
  const activeToken = await generateUniqueEmailToken();

  // Created expiration date 24hrs in advance
  const tokenExpiresAt = DateTime.now().plus({ day: 1 }).toJSDate();

  await context.prisma.email.upsert({
    where: {
      addressId: address.id,
    },
    update: {},
    create: {
      address: {
        connect: {
          id: address.id,
        },
      },
      emailAddress,
      activeToken,
      tokenExpiresAt,
    },
  });

  try {
    await sendVerificationEmail(emailAddress, activeToken);
    logger.info(`Sent confirmation email to ${emailAddress}`);
  } catch (err) {
    /* Log error, but don't return error to user. Sending the email is secondary to storing the form data */
    logger.error(`Received error when sending confirmation email to ${emailAddress} - ${err} `);
    return res.status(500).send({ msg: 'Email failed to send' });
  }

  logger.debug(`Completed request from ${req.body.address} to connect email: ${emailAddress}`);

  endTimer({ status: 200 });

  return res.status(200).send('ADDED');
});

emailRouter.delete('/', async function (req, res) {
  const logger = createScopedLogger('DELETE /email');

  logger.debug(`Params: ${JSON.stringify(req.params)} Body: ${JSON.stringify(req.body)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('DELETE', '/email');

  const schemaResult = RemoveEmailSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  /* BEGIN: Will be removed following address updates */
  // Resolve ENS if provided
  const resolvedAddress = await resolveENS(req.body.address);
  if (resolvedAddress === null) {
    logger.warn('Request address is invalid');
    endTimer({ status: 400 });
    return res.status(400).send({ msg: `${req.body.address} is not a valid address` });
  }

  if (
    !isSignatureValid(resolvedAddress, 'DELETE /email', req.body.signature, {
      id: req.body.id,
    })
  ) {
    logger.warn('Request signature is invalid');
    endTimer({ status: 401 });
    return res.status(401).send({ msg: 'The signature is not valid for this address and data' });
  }
  /* END: Will be removed following address updates */

  const { id } = req.body;

  logger.info(`Received request to delete email with id: ${id}`);

  try {
    await context.prisma.email.delete({
      where: {
        id,
      },
    });
  } catch (err) {
    logger.warn(`Tried to delete an email that doesn't exist: ${err}`);
    endTimer({ status: 404 });
    return res.status(404).send({ msg: `Invalid email ID provided` });
  }

  logger.debug(`Completed request to delete email with id: ${id}`);

  endTimer({ status: 200 });

  return res.status(200).send('DELETED');
});

emailRouter.post('/verify', async function (req, res) {
  const logger = createScopedLogger('POST /email/verify');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('POST', '/email/verify');

  const schemaResult = ValidateEmailSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { activeToken } = req.body;

  logger.info(`Request from ${req.body.address} to verify token: ${activeToken}`);

  const email = await context.prisma.email.findUnique({
    where: {
      activeToken,
    },
    select: {
      id: true,
      isValidated: true,
      tokenExpiresAt: true,
    },
  });
  if (email === null) {
    logger.error(`Failed to retrieve email data for token: ${activeToken}`);
    endTimer({ status: 404 });
    return res.status(404).send({ msg: 'INVALID' });
  }

  if (email.isValidated) {
    logger.warn(`User attempted to validate emailAddress that has already been validated`);

    endTimer({ status: 400 });
    return res.status(400).send({ msg: 'USED' });
  }

  if (DateTime.fromJSDate(email.tokenExpiresAt) < DateTime.now()) {
    logger.warn(`User attempted to use expired token: ${activeToken}`);

    await context.prisma.email.delete({
      where: {
        id: email.id,
      },
    });

    endTimer({ status: 401 });
    return res.status(401).send({ msg: 'EXPIRED' });
  }

  await context.prisma.email.update({
    where: {
      id: email.id,
    },
    data: {
      isValidated: true,
    },
  });

  logger.debug(`Completed verification request for token: ${activeToken}`);

  endTimer({ status: 200 });

  return res.status(200).send({ msg: 'VALID' });
});
