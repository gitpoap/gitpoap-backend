import { Router } from 'express';
import { createScopedLogger } from '../logging';
import { RefreshTokenPayload, getRefreshTokenPayload } from '../types/authTokens';
import { verify } from 'jsonwebtoken';
import { JWT_SECRET } from '../environment';
import { context } from '../context';
import { CreateAccessTokenSchema, RefreshAccessTokenSchema } from '../schemas/auth';
import { deleteAuthToken, generateAuthTokens, generateNewAuthTokens } from '../lib/authTokens';
import { resolveAddress } from '../lib/ens';
import { isAuthSignatureDataValid } from '../lib/signatures';
import { isGithubTokenValidForUser } from '../external/github';
import { removeGithubUsersGithubOAuthToken } from '../lib/githubUsers';
import { removeGithubLoginForAddress } from '../lib/addresses';
import { LOGIN_EXP_TIME_MONTHS } from '../constants';
import { DateTime } from 'luxon';
import { getRequestLogger } from '../middleware/loggingAndTiming';

export const authRouter = Router();

type GithubTokenData = {
  githubId: number | null;
  githubHandle: string | null;
};

async function getTokenDataWithGithubCheck(
  addressId: number,
  githubUserId: number,
  githubId: number,
  githubHandle: string,
  githubOAuthToken: string | null,
): Promise<GithubTokenData> {
  const logger = createScopedLogger('getTokenDataWithGithubCheck');

  if (await isGithubTokenValidForUser(githubOAuthToken, githubId)) {
    return { githubId, githubHandle };
  }

  logger.info(`Removing invalid GitHub OAuth token for User ID ${githubUserId}`);

  await removeGithubUsersGithubOAuthToken(githubUserId);

  await removeGithubLoginForAddress(addressId);

  return {
    githubId: null,
    githubHandle: null,
  };
}

async function upsertAddressAndSelectExtraData(address: string) {
  const logger = createScopedLogger('upsertAddressAndSelectExtraData');

  const addressLower = address.toLowerCase();

  try {
    return await context.prisma.address.upsert({
      where: {
        ethAddress: addressLower,
      },
      update: {},
      create: {
        ethAddress: addressLower,
      },
      select: {
        id: true,
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
          select: { id: true },
        },
      },
    });
  } catch (err) {
    logger.warn(`Caught error while trying to upsert address ${address}: ${err}`);

    // Return the record (which we assume to exist) if the upsert fails
    return await context.prisma.address.findUnique({
      where: {
        ethAddress: addressLower,
      },
      select: {
        id: true,
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
          select: { id: true },
        },
      },
    });
  }
}

authRouter.post('/', async function (req, res) {
  const logger = getRequestLogger(req);

  const schemaResult = CreateAccessTokenSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { address, signatureData } = schemaResult.data;

  logger.info(`Request to create AuthToken for address ${address}`);

  // Pre-fetch ENS info if it doesn't already exist
  const ensPromise = resolveAddress(address, { synchronous: true });

  // Validate signature
  if (!isAuthSignatureDataValid(address, signatureData)) {
    logger.warn(`Request signature is invalid for address ${address}`);
    return res.status(401).send({ msg: 'The signature is not valid for this address' });
  }

  // Wait for the ENS resolution to finish
  await ensPromise;

  // If the resolveAddress promise found an Address or new ENS name
  // this will already exist
  const dbAddress = await upsertAddressAndSelectExtraData(address);

  if (dbAddress === null) {
    logger.error(`Failed to upsert address ${address} during login`);
    return res.status(500).send({ msg: 'Login failed, please retry' });
  }

  let githubTokenData: GithubTokenData = { githubId: null, githubHandle: null };
  if (dbAddress.githubUser !== null) {
    githubTokenData = await getTokenDataWithGithubCheck(
      dbAddress.id,
      dbAddress.githubUser.id,
      dbAddress.githubUser.githubId,
      dbAddress.githubUser.githubHandle,
      dbAddress.githubUser.githubOAuthToken,
    );
  }

  const userAuthTokens = await generateNewAuthTokens(
    dbAddress.id,
    address.toLowerCase(),
    dbAddress.ensName,
    dbAddress.ensAvatarImageUrl,
    githubTokenData.githubId,
    githubTokenData.githubHandle,
    dbAddress.email?.id ?? null,
  );

  logger.debug(`Completed request to create AuthToken for address ${address}`);

  return res.status(200).send(userAuthTokens);
});

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
            select: { id: true },
          },
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

  const newAuthToken = await context.prisma.authToken.update({
    where: {
      id: payload.authTokenId,
    },
    data: {
      generation: { increment: 1 },
    },
    select: {
      generation: true,
    },
  });

  let githubTokenData: GithubTokenData = { githubId: null, githubHandle: null };
  if (authToken.address.githubUser !== null) {
    githubTokenData = await getTokenDataWithGithubCheck(
      authToken.address.id,
      authToken.address.githubUser.id,
      authToken.address.githubUser.githubId,
      authToken.address.githubUser.githubHandle,
      authToken.address.githubUser.githubOAuthToken,
    );
  }

  const userAuthTokens = generateAuthTokens(
    payload.authTokenId,
    newAuthToken.generation,
    authToken.address.id,
    authToken.address.ethAddress,
    authToken.address.ensName,
    authToken.address.ensAvatarImageUrl,
    githubTokenData.githubId,
    githubTokenData.githubHandle,
    authToken.address.email?.id ?? null,
  );

  logger.debug('Completed request to refresh AuthToken');

  return res.status(200).send(userAuthTokens);
});
