import fetch from 'cross-fetch';
import { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET } from '../environment';
import {
  DISCORD_URL,
  DISCORD_REDIRECT_URL,
  DISCORD_AUTH_GRANT_TYPE,
  DISCORD_AUTH_SCOPE,
} from '../constants';
import { createScopedLogger } from '../logging';

export type DiscordUser = {
  id: string;
  username: string;
  discriminator: string;
  bot?: boolean;
  verified?: boolean;
  email?: string | null;
};

export type DiscordOAuthToken = {
  token_type: string;
  access_token: string;
};

export async function requestDiscordOAuthToken(code: string) {
  const logger = createScopedLogger('requestDiscordOAuthToken');

  // Request to Discord -> exchange code (from request body) for a Discord access token
  const body = {
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    code,
    grant_type: DISCORD_AUTH_GRANT_TYPE,
    redirect_uri: DISCORD_REDIRECT_URL,
    scope: DISCORD_AUTH_SCOPE,
  };

  const tokenResponse = await fetch(`${DISCORD_URL}/api/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });

  const tokenJson = await tokenResponse.json();
  logger.debug(`Token JSON: ${tokenJson}`);
  if (tokenJson?.error) {
    logger.error(`Received bad response from discord: ${tokenJson?.error}`);
    throw new Error(tokenJson);
  }

  return tokenJson;
}

/** -- External Functions -- **/
export async function getDiscordCurrentUserInfo(discordToken: DiscordOAuthToken) {
  const logger = createScopedLogger('getDiscordCurrentUserInfo');

  const userResult = await fetch(`${DISCORD_URL}/api/users/@me`, {
    headers: {
      authorization: `${discordToken.token_type} ${discordToken.access_token}`,
    },
  });

  const userInfoJson = await userResult.json();

  logger.debug(`Token JSON: ${userInfoJson}`);
  if (userInfoJson?.error) {
    logger.error(`Received bad response from discord: ${userInfoJson?.error}`);
    return null;
  }

  return userInfoJson;
}
