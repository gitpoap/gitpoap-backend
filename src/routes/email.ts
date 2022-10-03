import crypto from 'crypto';
import { Router } from 'express';
import { MILLISECONDS_PER_DAY } from '../constants';

import { context } from '../context';
import { postmarkClient } from '../external/postmark';
import { resolveENS } from '../lib/ens';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import { AddEmailSchema, RemoveEmailSchema, ValidateEmailSchema } from '../schemas/email';
import { isSignatureValid } from '../signatures';

export const emailRouter = Router();

const generateUniqueEmailToken = async (
  byteLength: number = 20,
  stringBase: BufferEncoding = 'hex',
): Promise<string> => {
  let activeToken;
  let tokenIsUnique = false;
  do {
    activeToken = await new Promise<string>((resolve, reject) => {
      crypto.randomBytes(byteLength, (err, buffer) => {
        if (err) {
          reject(err);
        } else {
          resolve(buffer.toString(stringBase));
        }
      });
    });

    const email = await context.prisma.email.findUnique({
      where: {
        activeToken,
      },
    });
    // Token is unique if no email is found
    tokenIsUnique = email === null;
  } while (!tokenIsUnique);

  return activeToken;
};

const sendVerificationEmail = async (email: string, activeToken: string) => {
  postmarkClient.sendEmailWithTemplate({
    From: 'team@gitpoap.io',
    To: email,
    TemplateAlias: 'verify-email',
    TemplateModel: {
      product_url: 'gitpoap.io',
      product_name: 'GitPOAP',
      token: activeToken,
      support_email: 'team@gitpoap.io',
      company_name: 'MetaRep Labs Inc',
      company_address: 'One Broadway, Cambridge MA 02142',
    },
  });
};

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

  const { emailAddress } = req.body;

  logger.info(`Request from ${req.body.address} to connect email: ${emailAddress}`);

  // Generate a new token
  const activeToken = await generateUniqueEmailToken();

  // Created expiration date 24hrs in advance
  const tokenExpiresAt = new Date(new Date().getTime() + MILLISECONDS_PER_DAY);

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
    return res.status(404).send({ msg: `Invalid email provided` });
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

  if (email.tokenExpiresAt < new Date()) {
    logger.warn(`User attempted to use expired token: ${activeToken}`);

    await context.prisma.email.delete({
      where: {
        id: email.id,
      },
    });

    endTimer({ status: 400 });
    return res.status(400).send({ msg: 'EXPIRED' });
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