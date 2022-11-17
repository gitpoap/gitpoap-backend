import { Router } from 'express';
import { context } from '../context';
import { RequestAccessTokenSchema } from '../schemas/github';
import { requestGithubOAuthToken, getGithubCurrentUserInfo } from '../external/github';
import { generateAuthTokensWithChecks } from '../lib/authTokens';
import { jwtWithAddress } from '../middleware/auth';
import { getAccessTokenPayload } from '../types/authTokens';
import { upsertGithubUser } from '../lib/githubUsers';
import { addGithubLoginForAddress, removeGithubLoginForAddress } from '../lib/addresses';
import { getRequestLogger } from '../middleware/loggingAndTiming';

export const githubRouter = Router();

githubRouter.post('/', jwtWithAddress(), async function (req, res) {
  const logger = getRequestLogger(req);

  const schemaResult = RequestAccessTokenSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { authTokenId, addressId, address: ethAddress } = getAccessTokenPayload(req.user);
  let { code } = req.body;

  logger.info(`Received a GitHub login request from address ${ethAddress}`);

  // Remove state string if it exists
  const andIndex = code.indexOf('&');
  if (andIndex !== -1) {
    code = code.substring(0, andIndex);
  }

  let githubToken: string;
  try {
    githubToken = await requestGithubOAuthToken(code);
  } catch (err) {
    logger.warn(`Failed to request OAuth token with code: ${err}`);
    return res.status(400).send({
      msg: 'A server error has occurred - GitHub access token exchange',
    });
  }

  const githubInfo = await getGithubCurrentUserInfo(githubToken);
  if (githubInfo === null) {
    logger.error('Failed to retrieve data about logged in user');
    return res.status(500).send({
      msg: 'A server error has occurred - GitHub current user',
    });
  }

  // Update User with new OAuth token
  const githubUser = await upsertGithubUser(githubInfo.id, githubInfo.login, githubToken);

  /* Add the GitHub login to the address record */
  await addGithubLoginForAddress(addressId, githubUser.id);

  // Update the generation of the AuthToken (this should exist
  // since it was looked up within the middleware)
  let dbAuthToken;
  try {
    dbAuthToken = await context.prisma.authToken.update({
      where: {
        id: authTokenId,
      },
      data: {
        generation: { increment: 1 },
      },
      select: {
        generation: true,
        address: {
          select: {
            ensName: true,
            ensAvatarImageUrl: true,
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
  } catch (err) {
    logger.warn(
      `GithubUser ID ${githubUser.id}'s AuthToken was invalidated during GitHub login process`,
    );
    return res.status(401).send({ msg: 'Not logged in with address' });
  }

  const userAuthTokens = await generateAuthTokensWithChecks(authTokenId, dbAuthToken.generation, {
    ...dbAuthToken.address,
    id: addressId,
    ethAddress,
    githubUser,
  });

  logger.debug(`Completed a GitHub login request for address ${ethAddress}`);

  return res.status(200).send(userAuthTokens);
});

/* Route to remove a github connection from an address */
githubRouter.delete('/', jwtWithAddress(), async function (req, res) {
  const logger = getRequestLogger(req);

  const {
    authTokenId,
    addressId,
    address: ethAddress,
    githubHandle,
    githubId,
  } = getAccessTokenPayload(req.user);

  logger.info(`Received a GitHub disconnect request from address ${ethAddress}`);

  if (githubHandle === null || githubId === null) {
    logger.warn('No GitHub login found for address');
    return res.status(400).send({
      msg: 'No GitHub login found for address',
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
    },
    select: {
      generation: true,
      address: {
        select: {
          ensName: true,
          ensAvatarImageUrl: true,
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

  const userAuthTokens = await generateAuthTokensWithChecks(authTokenId, dbAuthToken.generation, {
    ...dbAuthToken.address,
    id: addressId,
    ethAddress,
    githubUser: null,
  });

  logger.debug(`Completed Github disconnect request for address ${ethAddress}`);

  return res.status(200).send(userAuthTokens);
});
