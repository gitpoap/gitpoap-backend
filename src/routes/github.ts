import { Router } from 'express';
import { context } from '../context';
import { RequestAccessTokenSchema } from '../schemas/github';
import { requestGithubOAuthToken, getGithubCurrentUserInfo } from '../external/github';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import { generateAuthTokens } from '../lib/authTokens';
import { jwtWithAddress } from '../middleware';
import { getAccessTokenPayload } from '../types/authTokens';
import { upsertUser } from '../lib/users';
import { addGithubLoginForAddress, removeGithubLoginForAddress } from '../lib/addresses';

export const githubRouter = Router();

githubRouter.post('/', jwtWithAddress(), async function (req, res) {
  const logger = createScopedLogger('POST /github');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('POST', '/github');

  const schemaResult = RequestAccessTokenSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { authTokenId, addressId, address, ensName, ensAvatarImageUrl } = getAccessTokenPayload(
    req.user,
  );
  let { code } = req.body;

  logger.info(`Received a GitHub login request from address ${address}`);

  // Remove state string if it exists
  const andIndex = code.indexOf('&');
  if (andIndex !== -1) {
    code = code.substr(0, andIndex);
  }

  let githubToken: string;
  try {
    githubToken = await requestGithubOAuthToken(code);
  } catch (err) {
    logger.warn(`Failed to request OAuth token with code: ${err}`);
    endTimer({ status: 400 });
    return res.status(400).send({
      message: 'A server error has occurred - GitHub access token exchange',
      error: err,
    });
  }

  const githubUser = await getGithubCurrentUserInfo(githubToken);
  if (githubUser === null) {
    logger.error('Failed to retrieve data about logged in user');
    endTimer({ status: 500 });
    return res.status(500).send({
      message: 'A server error has occurred - GitHub current user',
    });
  }

  // Update User with new OAuth token
  const user = await upsertUser(githubUser.id, githubUser.login, githubToken);

  /* Add the GitHub login to the address record */
  await addGithubLoginForAddress(addressId, user.id);

  // Update the generation of the AuthToken (this must exist
  // since it was looked up within the middleware)
  const dbAuthToken = await context.prisma.authToken.update({
    where: {
      id: authTokenId,
    },
    data: {
      generation: { increment: 1 },
      user: {
        connect: {
          id: user.id,
        },
      },
    },
    select: {
      generation: true,
    },
  });

  const userAuthTokens = generateAuthTokens(
    authTokenId,
    dbAuthToken.generation,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    githubUser.id,
    githubUser.login,
  );

  logger.debug(`Completed a GitHub login request for address ${address}`);

  endTimer({ status: 200 });

  return res.status(200).send(userAuthTokens);
});

/* Route to remove a github connection from an address */
githubRouter.delete('/', jwtWithAddress(), async function (req, res) {
  const logger = createScopedLogger('DELETE /github');

  const endTimer = httpRequestDurationSeconds.startTimer('DELETE', '/github');

  const { authTokenId, addressId, address, ensName, ensAvatarImageUrl, githubHandle, githubId } =
    getAccessTokenPayload(req.user);

  logger.info(`Received a GitHub disconnect request from address ${address}`);

  if (githubHandle === null || githubId === null) {
    logger.warn('No GitHub login found for address');
    endTimer({ status: 400 });
    return res.status(400).send({
      message: 'No GitHub login found for address',
    });
  }

  /* Remove the GitHub login from the address record */
  await removeGithubLoginForAddress(addressId);

  // Update the generation of the AuthToken (this must exist
  // since it was looked up within the middleware)
  const dbAuthToken = await context.prisma.authToken.update({
    where: { id: authTokenId },
    data: {
      generation: { increment: 1 },
      user: { disconnect: true },
    },
    select: { generation: true },
  });

  const userAuthTokens = generateAuthTokens(
    authTokenId,
    dbAuthToken.generation,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    null,
    null,
  );

  logger.debug(`Completed Github disconnect request for address ${address}`);

  endTimer({ status: 200 });

  return res.status(200).send(userAuthTokens);
});
