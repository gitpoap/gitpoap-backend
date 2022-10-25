import { Router } from 'express';
import { DateTime } from 'luxon';

import { context } from '../context';
import { sendVerificationEmail } from '../external/postmark';
import { generateUniqueEmailToken } from '../lib/email';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import { jwtWithAddress } from '../middleware';
import { AddEmailSchema } from '../schemas/email';
import { getAccessTokenPayload } from '../types/authTokens';

export const emailRouter = Router();

emailRouter.get('/', jwtWithAddress(), async function (req, res) {
  const logger = createScopedLogger('GET /email');

  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/email');

  const { address: ethAddress, addressId } = getAccessTokenPayload(req.user);

  logger.info(`Request to retrieve the email connected to: ${ethAddress}`);

  const email = await context.prisma.email.findUnique({
    where: {
      addressId,
    },
    select: {
      id: true,
      emailAddress: true,
      isValidated: true,
      tokenExpiresAt: true,
    },
  });

  logger.debug(`Completed request to retrieve the email connected to: ${ethAddress}`);

  endTimer({ status: 200 });

  return res.status(200).send({ email });
});

emailRouter.post('/', jwtWithAddress(), async function (req, res) {
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

  const { address: ethAddress, addressId } = getAccessTokenPayload(req.user);
  const { emailAddress } = req.body;

  logger.info(`Request from ${ethAddress} to connect email: ${emailAddress}`);

  // Generate a new token
  const activeToken = await generateUniqueEmailToken();

  // Created expiration date 24hrs in advance
  const tokenExpiresAt = DateTime.now().plus({ day: 1 }).toJSDate();

  await context.prisma.email.upsert({
    where: {
      addressId,
    },
    update: {},
    create: {
      address: {
        connect: {
          id: addressId,
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

  logger.debug(`Completed request from ${ethAddress} to connect email: ${emailAddress}`);

  endTimer({ status: 200 });

  return res.status(200).send('ADDED');
});

emailRouter.delete('/', jwtWithAddress(), async function (req, res) {
  const logger = createScopedLogger('DELETE /email');

  const endTimer = httpRequestDurationSeconds.startTimer('DELETE', '/email');

  const { address: ethAddress, addressId } = getAccessTokenPayload(req.user);

  logger.info(`Received request from ${ethAddress} to remove email connection`);

  try {
    await context.prisma.email.delete({
      where: {
        addressId,
      },
    });
  } catch (err) {
    logger.warn(`Tried to remove email connection that doesn't exist: ${err}`);
    endTimer({ status: 404 });
    return res.status(404).send({ msg: `No email connection present` });
  }

  logger.debug(`Completed request from ${ethAddress} to remove email connection`);

  endTimer({ status: 200 });

  return res.status(200).send('DELETED');
});

emailRouter.post('/verify/:activeToken', jwtWithAddress(), async function (req, res) {
  const logger = createScopedLogger('POST /email/verify/:activeToken');

  logger.debug(`Params: ${JSON.stringify(req.params)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('POST', '/email/verify/:activeToken');

  const { address: ethAddress } = getAccessTokenPayload(req.user);
  const activeToken = req.params.activeToken;

  logger.info(`Received request from ${ethAddress} to verify token: ${activeToken}`);

  const email = await context.prisma.email.findUnique({
    where: { activeToken },
    select: {
      id: true,
      isValidated: true,
      tokenExpiresAt: true,
    },
  });
  if (email === null) {
    logger.error(`Invalid email validation token provided: ${activeToken}`);
    endTimer({ status: 404 });
    return res.status(404).send({ msg: 'INVALID' });
  }

  if (!email.tokenExpiresAt) {
    logger.error(`Email validation token has no expiration date: ${activeToken}`);
    endTimer({ status: 400 });
    return res.status(400).send({ msg: 'INVALID' });
  }

  if (email.isValidated) {
    logger.warn('User attempted to validate emailAddress that has already been validated');
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

  logger.debug(`Completed request from ${ethAddress} to verify token: ${activeToken}`);

  endTimer({ status: 200 });

  return res.status(200).send({ msg: 'VALID' });
});
