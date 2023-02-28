import { verifyPrivyTokenForData } from '../external/privy';
import { createScopedLogger } from '../logging';
import { upsertAddress } from './addresses';
import { resolveAddress } from './ens';
import { upsertGithubUser } from './githubUsers';
import { AddressPayload, GithubPayload, EmailPayload, DiscordPayload } from '../types/authTokens';
import { upsertEmail } from './emails';
import { upsertDiscordUser } from './discordUsers';

export type PrivyUserData = {
  privyUserId: string;
  address: AddressPayload | null;
  github: GithubPayload | null;
  email: EmailPayload | null;
  discord: DiscordPayload | null;
};

export async function verifyPrivyToken(privyAuthToken: string): Promise<PrivyUserData | null> {
  const logger = createScopedLogger('verifyPrivyToken');

  const privyUserData = await verifyPrivyTokenForData(privyAuthToken);
  if (privyUserData === null) {
    logger.warn('Failed to verify token via Privy');
    return null;
  }

  // Used only in the case of errors
  const errorTail = `for Privy User ID ${privyUserData.privyUserId}`;

  let address: AddressPayload | null = null;
  if (privyUserData.ethAddress) {
    address = await upsertAddress(privyUserData.ethAddress);

    // Resolve the ENS name in the background
    void resolveAddress(privyUserData.ethAddress);
  }

  let github: GithubPayload | null = null;
  if (privyUserData.github) {
    github = await upsertGithubUser(
      privyUserData.github.githubId,
      privyUserData.github.githubHandle,
    );
  }

  let email: EmailPayload | null = null;
  if (privyUserData.emailAddress) {
    email = await upsertEmail(privyUserData.emailAddress);
    if (email === null) {
      logger.error(`Failed to upsert email address ${privyUserData.emailAddress} ${errorTail}`);
      return null;
    }
  }

  let discord: DiscordPayload | null = null;
  if (privyUserData.discord) {
    discord = await upsertDiscordUser(
      privyUserData.discord.discordId,
      privyUserData.discord.discordHandle,
    );
  }

  return {
    ...privyUserData,
    address,
    github,
    email,
    discord,
  };
}
