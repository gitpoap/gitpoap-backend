import { PRIVY_APP_ID, PRIVY_APP_SECRET, PRIVY_APP_PUBLIC_KEY } from '../environment';
import { createScopedLogger } from '../logging';
import { verify } from 'jsonwebtoken';
import fetch from 'cross-fetch';

const PUBLIC_KEY = PRIVY_APP_PUBLIC_KEY.replace(/\\n/g, '\n');

// Returns the did
function verifyPrivyToken(privyAuthToken: string): string | null {
  const logger = createScopedLogger('verifyPrivyToken');

  try {
    console.log(PUBLIC_KEY);
    logger.info(`PUBLIC_KEY = "${PUBLIC_KEY}"`);
    const result = verify(privyAuthToken, PUBLIC_KEY, {
      issuer: 'privy.io',
      audience: PRIVY_APP_ID,
    });

    if (typeof result === 'object' && 'sub' in result) {
      return result.sub ?? null;
    }

    logger.error('Missing "sub" field in valid Privy token');
  } catch (err) {
    logger.warn(`Privy token failed to verify: ${err}`);
  }

  return null;
}

type PrivyGithubDataResult = {
  githubId: number;
  githubHandle: string;
};

type PrivyDiscordDataResult = {
  discordId: string;
  discordHandle: string;
};

export type PrivyUserDataResult = {
  privyUserId: string;
  ethAddress: string | null;
  github: PrivyGithubDataResult | null;
  emailAddress: string | null;
  discord: PrivyDiscordDataResult | null;
};

const PRIVY_API_URL = 'https://auth.privy.io/api/v1/users/';

const PRIVY_BASIC_AUTH = `Basic ${Buffer.from(PRIVY_APP_ID + ':' + PRIVY_APP_SECRET).toString(
  'base64',
)}`;

async function getPrivyUser(privyUserId: string): Promise<PrivyUserDataResult | null> {
  const logger = createScopedLogger('getPrivyUser');

  try {
    const privyResponse = await fetch(`${PRIVY_API_URL}${privyUserId}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: PRIVY_BASIC_AUTH,
        'privy-app-id': PRIVY_APP_ID,
      },
    });

    if (privyResponse.status >= 400) {
      logger.error(
        `Bad response (${privyResponse.status}) for ${privyUserId}: ${await privyResponse.text()}`,
      );
      return null;
    }

    const data = await privyResponse.json();

    const result: PrivyUserDataResult = {
      privyUserId,
      ethAddress: null,
      github: null,
      emailAddress: null,
      discord: null,
    };

    for (const account of data.linked_accounts) {
      switch (account.type) {
        case 'wallet':
          if (account.chain_type === 'ethereum') {
            result.ethAddress = account.address.toLowerCase();
          } else {
            logger.warn("User's wallet is not an ETH wallet");
          }
          break;
        case 'github_oauth':
          result.github = {
            githubId: parseInt(account.subject, 10),
            githubHandle: account.username,
          };
          break;
        case 'email':
          result.emailAddress = account.address.toLowerCase();
          break;
        case 'discord_oauth':
          result.discord = {
            discordId: account.subject,
            discordHandle: account.username,
          };
          break;
        default:
          logger.warn(`Unknown account type "${account.type}"`);
      }
    }

    return result;
  } catch (err) {
    logger.error(`Failed to get Privy User "${privyUserId}": ${err}`);
    return null;
  }
}

export async function verifyPrivyTokenForData(
  privyAuthToken: string,
): Promise<PrivyUserDataResult | null> {
  const logger = createScopedLogger('verifyPrivyTokenForData');

  const privyUserId = verifyPrivyToken(privyAuthToken);
  if (privyUserId === null) {
    logger.warn('Failed to authenticate Privy Auth Token');
    return null;
  }

  return await getPrivyUser(privyUserId);
}
