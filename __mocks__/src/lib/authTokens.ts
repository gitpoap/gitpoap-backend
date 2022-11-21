import { AccessTokenPayload, RefreshTokenPayload } from '../../../src/types/authTokens';
import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '../../../src/environment';
import { JWT_EXP_TIME_SECONDS } from '../../../src/constants';

type GenAuthTokensExtras = {
  hasGithub?: boolean;
  hasDiscord?: boolean;
  hasEmail?: boolean;
};

type SetupGenAuthTokensArgs = {
  authTokenId: number;
  generation: number;
  addressId: number;
  address: string;
  ensName: string | null;
  ensAvatarImageUrl: string | null;
  githubId: number | null;
  githubHandle: string | null;
  discordId: string | null;
  discordHandle: string | null;
  emailId: number | null;
};

export function setupGenAuthTokens({
  authTokenId,
  generation,
  addressId,
  address,
  ensName,
  ensAvatarImageUrl,
  githubId,
  githubHandle,
  discordId,
  discordHandle,
  emailId,
}: SetupGenAuthTokensArgs) {
  const refreshTokenPayload: RefreshTokenPayload = {
    authTokenId,
    addressId,
    generation,
  };

  return (extras?: GenAuthTokensExtras) => {
    const accessTokenPayload: AccessTokenPayload = {
      authTokenId,
      addressId,
      address,
      ensName,
      ensAvatarImageUrl,
      githubId: extras?.hasGithub ? githubId : null,
      githubHandle: extras?.hasGithub ? githubHandle : null,
      discordId: extras?.hasDiscord ? discordId : null,
      discordHandle: extras?.hasDiscord ? discordHandle : null,
      emailId: extras?.hasEmail ? emailId : null,
    };

    return {
      accessToken: sign(accessTokenPayload, JWT_SECRET, { expiresIn: JWT_EXP_TIME_SECONDS }),
      refreshToken: sign(refreshTokenPayload, JWT_SECRET),
    };
  };
}
