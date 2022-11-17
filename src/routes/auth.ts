import { Router } from 'express';
import { RefreshTokenPayload, getRefreshTokenPayload } from '../types/authTokens';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '../environment';
import { context } from '../context';
import { CreateAccessTokenSchema, RefreshAccessTokenSchema } from '../schemas/auth';
import {
  deleteAuthToken,
  generateAuthTokensWithChecks,
  generateNewAuthTokens,
} from '../lib/authTokens';
import { resolveAddress } from '../lib/ens';
import { isAuthSignatureDataValid } from '../lib/signatures';
import { upsertAddress } from '../lib/addresses';
import { LOGIN_EXP_TIME_MONTHS } from '../constants';
import { DateTime } from 'luxon';
import { getRequestLogger } from '../middleware/loggingAndTiming';

export const authRouter = Router();

authRouter.post('/', async function (req, res) {
  const logger = getRequestLogger(req);

  const schemaResult = CreateAccessTokenSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { address: ethAddress, signatureData } = schemaResult.data;

  logger.info(`Request to create AuthToken for address ${ethAddress}`);

  // Pre-fetch ENS info if it doesn't already exist
  const ensPromise = resolveAddress(ethAddress, { synchronous: true });

  // Validate signature
  if (!isAuthSignatureDataValid(ethAddress, signatureData)) {
    logger.warn(`Request signature is invalid for address ${ethAddress}`);
    return res.status(401).send({ msg: 'The signature is not valid for this address' });
  }

  // Wait for the ENS resolution to finish
  await ensPromise;

  // If the resolveAddress promise found an Address or new ENS name
  // this will already exist
  const address = await upsertAddress(ethAddress);

  if (address === null) {
    logger.error(`Failed to upsert address ${ethAddress} during login`);
    return res.status(500).send({ msg: 'Login failed, please retry' });
  }

  const userAuthTokens = await generateNewAuthTokens(address.id);

  logger.debug(`Completed request to create AuthToken for address ${ethAddress}`);

  return res.status(200).send(userAuthTokens);
});

async function updateAuthTokenGeneration(authTokenId: number) {
  return await context.prisma.authToken.update({
    where: { id: authTokenId },
    data: {
      generation: { increment: 1 },
    },
    select: {
      generation: true,
      address: {
        select: {
          id: true,
          ethAddress: true,
          ensName: true,
          ensAvatarImageUrl: true,
          githubUser: {
            select: {
              id: true,
              githubId: true,
              githubHandle: true,
              githubOAuthToken: true,
            },
          },
          email: {
            select: {
              id: true,
              isValidated: true,
            },
          },
        },
      },
    },
  });
}

authRouter.post('/refresh', async function (req, res) {
  const logger = getRequestLogger(req);

  const schemaResult = RefreshAccessTokenSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info('Request to refresh AuthToken');

  const { token } = req.body;

  let payload: RefreshTokenPayload;
  try {
    payload = getRefreshTokenPayload(verify(token, JWT_SECRET));
  } catch (err) {
    logger.warn('The refresh token is invalid');
    return res.status(401).send({ msg: 'The refresh token is invalid' });
  }

  const authToken = await context.prisma.authToken.findUnique({
    where: {
      id: payload.authTokenId,
    },
    select: {
      createdAt: true,
      generation: true,
      address: {
        select: {
          id: true,
          ethAddress: true,
        },
      },
    },
  });
  if (authToken === null) {
    logger.warn('The refresh token is invalid');
    return res.status(401).send({ msg: 'The refresh token is invalid' });
  }

  // If someone is trying to use an old generation of the refresh token, we must
  // consider the lineage to be tainted, and therefore purge it completely
  // (user will need to resign to log back in).
  if (payload.generation !== authToken.generation) {
    logger.warn(`Address ${authToken.address.ethAddress} had a refresh token reused.`);

    await deleteAuthToken(payload.authTokenId);

    return res.status(401).send({ msg: 'The refresh token has already been used' });
  }

  const expirationTime = DateTime.fromJSDate(authToken.createdAt).plus({
    months: LOGIN_EXP_TIME_MONTHS,
  });
  if (expirationTime < DateTime.now()) {
    logger.warn(`The login for address "${authToken.address.ethAddress}" has expired`);

    await deleteAuthToken(payload.authTokenId);

    return res.status(401).send({ msg: "User's login has expired" });
  }

  const newAuthToken = await updateAuthTokenGeneration(payload.authTokenId);

  const userAuthTokens = await generateAuthTokensWithChecks(
    payload.authTokenId,
    newAuthToken.generation,
    newAuthToken.address,
  );

  logger.debug('Completed request to refresh AuthToken');

  return res.status(200).send(userAuthTokens);
});
