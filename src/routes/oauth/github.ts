import { Router } from 'express';
import { RequestAccessTokenSchema } from '../../schemas/oauth/github';
import { requestGithubOAuthToken, getGithubCurrentUserInfo } from '../../external/github';
import { generateNewAuthTokens } from '../../lib/authTokens';
import { jwtAccessToken, jwtWithGithubOAuth } from '../../middleware/auth';
import {
  getAccessTokenPayload,
  getAccessTokenPayloadWithGithubOAuth,
} from '../../types/authTokens';
import { upsertGithubUser, removeGithubUsersLogin } from '../../lib/githubUsers';
import { getRequestLogger } from '../../middleware/loggingAndTiming';

export const githubRouter = Router();

githubRouter.post('/', jwtAccessToken(), async function (req, res) {
  const logger = getRequestLogger(req);

  const schemaResult = RequestAccessTokenSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const accessTokenPayload = getAccessTokenPayload(req.user);

  let { code } = req.body;

  logger.info(`Received a GitHub login request from Privy ID ${accessTokenPayload.privyUserId}`);

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
    accessTokenPayload.privyUserId,
    githubToken,
  );

  const userAuthTokens = await generateNewAuthTokens({
    ...accessTokenPayload,
    github: {
      ...githubUser,
      githubOAuthToken: githubToken,
    },
  });

  logger.debug(`Completed a GitHub login request from Privy ID ${accessTokenPayload.privyUserId}`);

  return res.status(200).send(userAuthTokens);
});

/* Route to remove a github connection from an address */
githubRouter.delete('/', jwtWithGithubOAuth(), async function (req, res) {
  const logger = getRequestLogger(req);

  const accessTokenPayload = getAccessTokenPayloadWithGithubOAuth(req.user);

  logger.info(
    `Received a GitHub disconnect request from GitHub handle ${accessTokenPayload.github.githubHandle}`,
  );

  await removeGithubUsersLogin(accessTokenPayload.github.id);

  const userAuthTokens = await generateNewAuthTokens({
    ...accessTokenPayload,
    github: null,
  });

  logger.debug(
    `Received a GitHub disconnect request from GitHub handle ${accessTokenPayload.github.githubHandle}`,
  );

  return res.status(200).send(userAuthTokens);
});
