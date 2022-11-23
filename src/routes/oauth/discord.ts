import { Router } from 'express';
import {
  requestDiscordOAuthToken,
  getDiscordCurrentUserInfo,
  DiscordOAuthToken,
} from '../../external/discord';
import { jwtWithAddress } from '../../middleware/auth';
import { RequestAccessTokenSchema } from '../../schemas/discord';
import { getAccessTokenPayload } from '../../types/authTokens';
import { upsertDiscordUser } from '../../lib/discordUsers';
import { generateAuthTokensWithChecks, updateAuthTokenGeneration } from '../../lib/authTokens';
import { addDiscordLoginForAddress, removeDiscordLoginForAddress } from '../../lib/addresses';
import { getRequestLogger } from '../../middleware/loggingAndTiming';

export const discordRouter = Router();

discordRouter.post('/', jwtWithAddress(), async function (req, res) {
  const logger = getRequestLogger(req);

  const schemaResult = RequestAccessTokenSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { authTokenId, addressId, address: ethAddress } = getAccessTokenPayload(req.user);
  const { code } = schemaResult.data;

  logger.info(`Received a Discord login request from address ${ethAddress}`);

  let discordToken: string;
  try {
    const token: DiscordOAuthToken = await requestDiscordOAuthToken(code);
    discordToken = `${token.token_type} ${token.access_token}`;
  } catch (err) {
    logger.warn(`Failed to request OAuth token with code: ${err}`);
    return res.status(400).send({
      msg: 'A server error has occurred - Discord access token exchange',
    });
  }

  const discordInfo = await getDiscordCurrentUserInfo(discordToken);
  if (discordInfo === null) {
    logger.error('Failed to retrieve data about logged in user');
    return res.status(500).send({
      msg: 'A server error has occurred - Discord current user',
    });
  }

  // Update User with new OAuth token
  const discordUser = await upsertDiscordUser(discordInfo.id, discordInfo.username, discordToken);

  /* Add the discord login to the address record */
  await addDiscordLoginForAddress(addressId, discordUser.id);

  // Update the generation of the AuthToken (this should exist
  // since it was looked up within the middleware)
  let dbAuthToken;
  try {
    dbAuthToken = await updateAuthTokenGeneration(authTokenId);
  } catch (err) {
    logger.warn(
      `DiscordUser ID ${discordUser.id}'s AuthToken was invalidated during Discord login process`,
    );
    return res.status(401).send({ msg: 'Not logged in with address' });
  }

  const userAuthTokens = await generateAuthTokensWithChecks(authTokenId, dbAuthToken.generation, {
    ...dbAuthToken.address,
    id: addressId,
    ethAddress,
    discordUser,
  });

  logger.debug(`Completed a Discord login request for address ${ethAddress}`);

  return res.status(200).send(userAuthTokens);
});

/* Route to remove a discord connection from an address */
discordRouter.delete('/', jwtWithAddress(), async function (req, res) {
  const logger = getRequestLogger(req);

  const {
    authTokenId,
    addressId,
    address: ethAddress,
    discordId,
    discordHandle,
  } = getAccessTokenPayload(req.user);

  logger.info(`Received a Discord disconnect request from address ${ethAddress}`);

  if (discordHandle === null || discordId === null) {
    logger.warn('No Discord login found for address');
    return res.status(400).send({
      msg: 'No Discord login found for address',
    });
  }

  /* Remove the Discord login from the address record */
  await removeDiscordLoginForAddress(addressId);

  // Update the generation of the AuthToken (this must exist
  // since it was looked up within the middleware)
  const dbAuthToken = await updateAuthTokenGeneration(authTokenId);

  const userAuthTokens = await generateAuthTokensWithChecks(authTokenId, dbAuthToken.generation, {
    ...dbAuthToken.address,
    id: addressId,
    ethAddress,
    discordUser: null,
  });

  logger.debug(`Completed Discord disconnect request for address ${ethAddress}`);

  return res.status(200).send(userAuthTokens);
});
