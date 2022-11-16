import { Router } from 'express';
import { context } from '../context';
import { requestDiscordOAuthToken, getDiscordCurrentUserInfo } from '../external/discord';
import { generateAuthTokens } from '../lib/authTokens';
import { jwtWithAddress } from '../middleware/auth';
import { getAccessTokenPayload } from '../types/authTokens';
import { upsertDiscordUser } from '../lib/discordUsers';
import { addDiscordLoginForAddress, removeDiscordLoginForAddress } from '../lib/addresses';
import { getRequestLogger } from '../middleware/loggingAndTiming';

export const discordRouter = Router();

discordRouter.post('/', jwtWithAddress(), async function (req, res) {
  const logger = getRequestLogger(req);

  const { authTokenId, addressId, address, ensName, ensAvatarImageUrl } = getAccessTokenPayload(
    req.user,
  );
  const { code } = req.params;

  logger.info(`Received a Discord login request from address ${address}`);

  let discordToken: string;
  try {
    discordToken = await requestDiscordOAuthToken(code);
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
  let newGeneration: number;
  try {
    newGeneration = (
      await context.prisma.authToken.update({
        where: {
          id: authTokenId,
        },
        data: {
          generation: { increment: 1 },
          discordUser: {
            connect: {
              id: discordUser.id,
            },
          },
        },
        select: {
          generation: true,
        },
      })
    ).generation;
  } catch (err) {
    logger.warn(
      `DiscordUser ID ${discordUser.id}'s AuthToken was invalidated during Discord login process`,
    );
    return res.status(401).send({ msg: 'Not logged in with address' });
  }
  // NOTE; we will need discordId and discordHandle into token if we need those in the future
  const userAuthTokens = generateAuthTokens(
    authTokenId,
    newGeneration,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    null,
    null,
  );

  logger.debug(`Completed a Discord login request for address ${address}`);

  return res.status(200).send(userAuthTokens);
});

/* Route to remove a discord connection from an address */
discordRouter.delete('/', jwtWithAddress(), async function (req, res) {
  const logger = getRequestLogger(req);

  const { authTokenId, addressId, address, ensName, ensAvatarImageUrl } = getAccessTokenPayload(
    req.user,
  );

  logger.info(`Received a Discord disconnect request from address ${address}`);

  /* Remove the Discord login from the address record */
  await removeDiscordLoginForAddress(addressId);

  // Update the generation of the AuthToken (this must exist
  // since it was looked up within the middleware)
  const dbAuthToken = await context.prisma.authToken.update({
    where: { id: authTokenId },
    data: {
      generation: { increment: 1 },
      discordUser: { disconnect: true },
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

  logger.debug(`Completed Discord disconnect request for address ${address}`);

  return res.status(200).send(userAuthTokens);
});
