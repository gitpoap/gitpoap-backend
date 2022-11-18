import { Router } from 'express';
import { DateTime } from 'luxon';
import { context } from '../context';
import { sendVerificationEmail } from '../external/postmark';
import { jwtWithAddress } from '../middleware/auth';
import { AddEmailSchema } from '../schemas/email';
import { getAccessTokenPayload } from '../types/authTokens';
import { getRequestLogger } from '../middleware/loggingAndTiming';
import { generateUniqueEmailToken, upsertUnverifiedEmail } from '../lib/emails';
import { generateAuthTokensWithChecks, updateAuthTokenGeneration } from '../lib/authTokens';

export const emailRouter = Router();

emailRouter.get('/', jwtWithAddress(), async function (req, res) {
  const logger = getRequestLogger(req);

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

  return res.status(200).send({ email });
});

emailRouter.post('/', jwtWithAddress(), async function (req, res) {
  const logger = getRequestLogger(req);

  const schemaResult = AddEmailSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { address: ethAddress, addressId } = getAccessTokenPayload(req.user);
  const { emailAddress } = req.body;

  logger.info(`Request from ${ethAddress} to connect email: ${emailAddress}`);

  const email = await context.prisma.email.findUnique({
    where: { emailAddress },
    select: {
      id: true,
      isValidated: true,
      tokenExpiresAt: true,
    },
  });

  const isEmailPending =
    email?.tokenExpiresAt && DateTime.fromJSDate(email.tokenExpiresAt) > DateTime.now();
  const isEmailTaken = email?.isValidated || isEmailPending;

  if (isEmailTaken) {
    logger.warn('User attempted to connect emailAddress that is already in use');
    return res.status(400).send({ msg: 'TAKEN' });
  }

  // Generate a new token
  const activeToken = await generateUniqueEmailToken();

  // Created expiration date 24hrs in advance
  const tokenExpiresAt = DateTime.now().plus({ day: 1 }).toJSDate();

  const result = await upsertUnverifiedEmail(emailAddress, activeToken, tokenExpiresAt, addressId);
  if (result === null) {
    logger.error(`Failed to upsert unverified Email "${emailAddress}" for Address ID ${addressId}`);
    return res.status(500).send({ msg: 'Failed to setup email address' });
  }

  try {
    await sendVerificationEmail(emailAddress, activeToken);
    logger.info(`Sent confirmation email to ${emailAddress}`);
  } catch (err) {
    /* Log error, but don't return error to user. Sending the email is secondary to storing the form data */
    logger.error(`Received error when sending confirmation email to ${emailAddress} - ${err} `);
    return res.status(500).send({ msg: 'Email failed to send' });
  }

  logger.debug(`Completed request from ${ethAddress} to connect email: ${emailAddress}`);

  return res.status(200).send({ msg: 'SUBMITTED' });
});

emailRouter.delete('/', jwtWithAddress(), async function (req, res) {
  const logger = getRequestLogger(req);

  const { address: ethAddress, addressId, authTokenId } = getAccessTokenPayload(req.user);

  logger.info(`Received request from ${ethAddress} to remove email connection`);

  try {
    await context.prisma.email.update({
      where: {
        addressId,
      },
      data: {
        activeToken: null,
        addressId: null,
        isValidated: false,
        tokenExpiresAt: null,
      },
    });
  } catch (err) {
    logger.warn(`Tried to remove email connection that doesn't exist: ${err}`);
    return res.status(404).send({ msg: `No email connection present` });
  }

  const dbAuthToken = await updateAuthTokenGeneration(authTokenId);

  const tokens = await generateAuthTokensWithChecks(
    authTokenId,
    dbAuthToken.generation,
    dbAuthToken.address,
  );

  logger.debug(`Completed request from ${ethAddress} to remove email connection`);

  return res.status(200).send({
    msg: 'DELETED',
    tokens,
  });
});

emailRouter.post('/verify/:activeToken', jwtWithAddress(), async function (req, res) {
  const logger = getRequestLogger(req);

  const { address: ethAddress, authTokenId } = getAccessTokenPayload(req.user);
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
    return res.status(404).send({ msg: 'INVALID' });
  }

  // This really shouldn't ever happen, but just in case
  if (!email.tokenExpiresAt) {
    logger.error(`Email validation token has no expiration date: ${activeToken}`);
    await context.prisma.email.update({
      where: {
        id: email.id,
      },
      data: {
        activeToken: null,
        addressId: null,
        tokenExpiresAt: null,
      },
    });
    return res.status(500).send({ msg: 'INVALID' });
  }

  if (email.isValidated) {
    logger.warn('User attempted to validate emailAddress that has already been validated');
    return res.status(400).send({ msg: 'USED' });
  }

  if (DateTime.fromJSDate(email.tokenExpiresAt) < DateTime.now()) {
    logger.warn(`User attempted to use expired token: ${activeToken}`);

    await context.prisma.email.update({
      where: {
        id: email.id,
      },
      data: {
        activeToken: null,
        addressId: null,
        tokenExpiresAt: null,
      },
    });

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

  const dbAuthToken = await updateAuthTokenGeneration(authTokenId);

  const tokens = await generateAuthTokensWithChecks(
    authTokenId,
    dbAuthToken.generation,
    dbAuthToken.address,
  );

  logger.debug(`Completed request from ${ethAddress} to verify token: ${activeToken}`);

  return res.status(200).send({
    msg: 'VALID',
    tokens,
  });
});
