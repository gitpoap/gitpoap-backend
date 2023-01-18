import { AccessTokenPayload, Memberships } from '../../../src/types/authTokens';
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
  memberships: Memberships;
  githubId: number | null;
  githubHandle: string | null;
  discordHandle: string | null;
  emailAddress: string | null;
};

export function setupGenAuthTokens({
  privyUserId,
  addressId,
  ethAddress,
  ensName,
  ensAvatarImageUrl,
  memberships,
  githubId,
  githubHandle,
  discordHandle,
  emailAddress,
}: SetupGenAuthTokensArgs) {
  return (extras?: GenAuthTokensExtras) => {
    const accessTokenPayload: AccessTokenPayload = {
      privyUserId,
      addressId,
      ethAddress,
      ensName,
      ensAvatarImageUrl,
      memberships,
      githubId: extras?.hasGithub ? githubId : null,
      githubHandle: extras?.hasGithub ? githubHandle : null,
      discordHandle: extras?.hasDiscord ? discordHandle : null,
      emailAddress: extras?.hasEmail ? emailAddress : null,
    };

    return {
      accessToken: sign(accessTokenPayload, JWT_SECRET, { expiresIn: JWT_EXP_TIME_SECONDS }),
    };
  };
}
