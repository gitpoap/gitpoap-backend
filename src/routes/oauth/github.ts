import { Router } from 'express';
import { RequestAccessTokenSchema } from '../../schemas/oauth/github';
import { requestGithubOAuthToken, getGithubCurrentUserInfo } from '../../external/github';
import { generateNewAuthTokens } from '../../lib/authTokens';
import { jwtWithAddress } from '../../middleware/auth';
import { getAccessTokenPayload } from '../../types/authTokens';
import { upsertGithubUser, removeGithubUsersLogin } from '../../lib/githubUsers';
import { getRequestLogger } from '../../middleware/loggingAndTiming';

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

  const { privyUserId, addressId, ethAddress, discordHandle, emailAddress } = getAccessTokenPayload(
    req.user,
  );

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
  const githubUser = await upsertGithubUser(
    githubInfo.id,
    githubInfo.login,
    privyUserId,
    githubToken,
  );

  const userAuthTokens = await generateNewAuthTokens({
    privyUserId,
    addressId,
    ethAddress,
    discordHandle,
    emailAddress,
    githubUser: {
      ...githubUser,
      githubOAuthToken: githubToken,
    },
  });

  logger.debug(`Completed a GitHub login request for address ${ethAddress}`);

  return res.status(200).send(userAuthTokens);
});

/* Route to remove a github connection from an address */
githubRouter.delete('/', jwtWithAddress(), async function (req, res) {
  const logger = getRequestLogger(req);

  const {
    privyUserId,
    addressId,
    ethAddress,
    githubId,
    githubHandle,
    discordHandle,
    emailAddress,
  } = getAccessTokenPayload(req.user);

  logger.info(`Received a GitHub disconnect request from address ${ethAddress}`);

  if (githubHandle === null || githubId === null) {
    logger.warn('No GitHub login found for address');
    return res.status(400).send({
      msg: 'No GitHub login found for address',
    });
  }

  await removeGithubUsersLogin(privyUserId);

  const userAuthTokens = await generateNewAuthTokens({
    privyUserId,
    addressId,
    ethAddress,
    discordHandle,
    emailAddress,
    githubUser: null,
  });

  logger.debug(`Completed Github disconnect request for address ${ethAddress}`);

  return res.status(200).send(userAuthTokens);
});
