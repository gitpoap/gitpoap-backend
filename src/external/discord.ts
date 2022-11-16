import fetch from 'cross-fetch';
import {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_URL,
  DISCORD_REDIRECT_URL,
} from '../environment';
import { createScopedLogger } from '../logging';
import { REST, Routes } from 'discord.js';

export type DiscordUser = {
  id: number;
  username: string;
  discriminator: string;
  bot?: boolean;
  verified?: boolean;
  email?: string | null;
};

async function responseHandler<T>(responsePromise: Promise<any>): Promise<T | null> {
  const logger = createScopedLogger('responseHandler');

  try {
    return (await responsePromise).data;
  } catch (err) {
    logger.error(`Received bad response from octokit: ${err}`);

    return null;
  }
}

export async function requestDiscordOAuthToken(code: string) {
  const logger = createScopedLogger('requestDiscordOAuthToken');

  // Request to Discord -> exchange code (from request body) for a Discord access token
  const body = {
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    code,
    redirect_uri: DISCORD_REDIRECT_URL,
  };

  const tokenResponse = await fetch(`${DISCORD_URL}/api/oauth2/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const tokenJson = await tokenResponse.json();
  logger.debug(`Token JSON: ${tokenJson}`);
  if (tokenJson?.error) {
    /* don't use JSON.stringify long term here */
    throw JSON.stringify(tokenJson);
  }

  return tokenJson.access_token;
}

function getOAuthDiscordRest(discordOAuthToken: string) {
  return new REST({ version: '10' }).setToken(discordOAuthToken);
}

/** -- External Functions -- **/
export async function getDiscordCurrentUserInfo(discordToken: string) {
  const rest = getOAuthDiscordRest(discordToken);
  return await responseHandler<DiscordUser>(rest.get(Routes.user()));
}
