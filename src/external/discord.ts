import fetch from 'cross-fetch';
import { DISCORD_URL } from '../constants';
import { createScopedLogger } from '../logging';

type DiscordUser = {
  id: string;
  username: string;
  discriminator: string;
  bot?: boolean;
  verified?: boolean;
  email?: string | null;
};

export async function getDiscordCurrentUserInfo(discordToken: string): Promise<DiscordUser | null> {
  const logger = createScopedLogger('getDiscordCurrentUserInfo');

  const userResult = await fetch(`${DISCORD_URL}/api/users/@me`, {
    headers: { authorization: discordToken },
  });

  const userInfoJson = await userResult.json();

  logger.debug(`Token JSON: ${userInfoJson}`);

  if (userInfoJson?.error) {
    logger.error(`Received bad response from discord: ${userInfoJson?.error}`);
    return null;
  }

  return userInfoJson;
}
