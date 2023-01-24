import {
  AccessTokenPayload,
  DiscordPayload,
  EmailPayload,
  GithubPayload,
  MembershipsPayload,
} from '../../../src/types/authTokens';
import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '../../../src/environment';
import { JWT_EXP_TIME_SECONDS } from '../../../src/constants';

type GenAuthTokensExtras = {
  hasGithub?: boolean;
  hasDiscord?: boolean;
  hasEmail?: boolean;
};

type SetupGenAuthTokensArgs = {
  privyUserId: string;
  addressId: number;
  ethAddress: string;
  ensName: string | null;
  ensAvatarImageUrl: string | null;
  memberships?: MembershipsPayload;
  githubUserId?: number;
  githubId?: number;
  githubHandle?: string;
  emailAddress?: string;
  discordHandle?: string;
};

export function setupGenAuthTokens({
  privyUserId,
  addressId,
  ethAddress,
  ensName,
  ensAvatarImageUrl,
  memberships,
  githubUserId,
  githubId,
  githubHandle,
  emailAddress,
  discordHandle,
}: SetupGenAuthTokensArgs) {
  return (extras?: GenAuthTokensExtras) => {
    let github: GithubPayload | null = null;
    if (extras?.hasGithub && githubId !== undefined && githubHandle !== undefined) {
      github = {
        id: githubUserId ?? 1,
        githubId,
        githubHandle,
      };
    }

    let email: EmailPayload | null = null;
    if (extras?.hasEmail && emailAddress !== undefined) {
      email = {
        id: 1, // Dummy since it's not used in tests yet
        emailAddress,
      };
    }

    let discord: DiscordPayload | null = null;
    if (extras?.hasDiscord && discordHandle !== undefined) {
      discord = {
        id: 1, // Dummy since it's not used in tests yet
        discordId: '1', // Dummy since it's not used in tests yet
        discordHandle,
      };
    }

    const accessTokenPayload: AccessTokenPayload = {
      privyUserId,
      address: {
        id: addressId,
        ethAddress,
        ensName,
        ensAvatarImageUrl,
      },
      github,
      email,
      discord,
      memberships: memberships ?? [],
    };

    return {
      accessTokenPayload: Object.assign({}, accessTokenPayload),
      accessToken: sign(accessTokenPayload, JWT_SECRET, { expiresIn: JWT_EXP_TIME_SECONDS }),
    };
  };
}
