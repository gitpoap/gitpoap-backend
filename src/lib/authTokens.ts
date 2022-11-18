import { context } from '../context';
import { JWT_EXP_TIME_SECONDS } from '../constants';
import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '../environment';
import { AccessTokenPayload, RefreshTokenPayload, UserAuthTokens } from '../types/authTokens';
import { createScopedLogger } from '../logging';
import { isGithubTokenValidForUser } from '../external/github';
import { removeGithubUsersGithubOAuthToken } from '../lib/githubUsers';
import { removeGithubLoginForAddress } from '../lib/addresses';

async function createAuthToken(addressId: number) {
  return await context.prisma.authToken.create({
    data: {
      address: {
        connect: {
          id: addressId,
        },
      },
    },
    select: {
      id: true,
      generation: true,
      address: {
        select: {
          id: true,
          ethAddress: true,
          ensName: true,
          ensAvatarImageUrl: true,
          githubUser: {
            select: {
              id: true,
              githubId: true,
              githubHandle: true,
              githubOAuthToken: true,
            },
          },
          email: {
            select: {
              id: true,
              isValidated: true,
            },
          },
        },
      },
    },
  });
}

type CheckGithubUserType = {
  id: number;
  githubId: number;
  githubHandle: string;
  githubOAuthToken: string | null;
};

type GithubTokenData = {
  githubId: number | null;
  githubHandle: string | null;
};

async function checkGithubTokenData(
  addressId: number,
  githubUser: CheckGithubUserType | null,
): Promise<GithubTokenData> {
  const logger = createScopedLogger('getTokenDataWithGithubCheck');

  if (githubUser === null) {
    return {
      githubId: null,
      githubHandle: null,
    };
  }

  if (await isGithubTokenValidForUser(githubUser.githubOAuthToken, githubUser.githubId)) {
    return {
      githubId: githubUser.githubId,
      githubHandle: githubUser.githubHandle,
    };
  }

  logger.info(`Removing invalid GitHub OAuth token for GithubUser ID ${githubUser.id}`);

  await removeGithubUsersGithubOAuthToken(githubUser.id);

  await removeGithubLoginForAddress(addressId);

  return {
    githubId: null,
    githubHandle: null,
  };
}

function generateAccessToken(payload: AccessTokenPayload): string {
  return sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXP_TIME_SECONDS,
  });
}

function generateRefreshToken(payload: RefreshTokenPayload) {
  return sign(payload, JWT_SECRET);
}

export function generateAuthTokens(
  authTokenId: number,
  authTokenGeneration: number,
  addressId: number,
  address: string,
  ensName: string | null,
  ensAvatarImageUrl: string | null,
  githubId: number | null,
  githubHandle: string | null,
  emailId: number | null,
): UserAuthTokens {
  const accessTokenPayload: AccessTokenPayload = {
    authTokenId,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    githubId,
    githubHandle,
    emailId,
  };
  const refreshTokenPayload: RefreshTokenPayload = {
    authTokenId,
    addressId,
    generation: authTokenGeneration,
  };

  return {
    accessToken: generateAccessToken(accessTokenPayload),
    refreshToken: generateRefreshToken(refreshTokenPayload),
  };
}

type CheckEmailType = {
  id: number;
  isValidated: boolean;
};

type CheckAddressType = {
  id: number;
  ethAddress: string;
  ensName: string | null;
  ensAvatarImageUrl: string | null;
  githubUser: CheckGithubUserType | null;
  email: CheckEmailType | null;
};

export async function generateAuthTokensWithChecks(
  authTokenId: number,
  generation: number,
  address: CheckAddressType,
): Promise<UserAuthTokens> {
  const { githubId, githubHandle } = await checkGithubTokenData(address.id, address.githubUser);

  let emailId: number | null = null;
  if (address.email !== null) {
    emailId = address.email.isValidated ? address.email.id : null;
  }

  return generateAuthTokens(
    authTokenId,
    generation,
    address.id,
    address.ethAddress,
    address.ensName,
    address.ensAvatarImageUrl,
    githubId,
    githubHandle,
    emailId,
  );
}

export async function generateNewAuthTokens(addressId: number): Promise<UserAuthTokens> {
  const dbAuthToken = await createAuthToken(addressId);

  return generateAuthTokensWithChecks(dbAuthToken.id, dbAuthToken.generation, dbAuthToken.address);
}

export async function deleteAuthToken(authTokenId: number) {
  await context.prisma.authToken.delete({
    where: {
      id: authTokenId,
    },
  });
}

export async function updateAuthTokenGeneration(authTokenId: number) {
  return await context.prisma.authToken.update({
    where: { id: authTokenId },
    data: {
      generation: { increment: 1 },
    },
    select: {
      generation: true,
      address: {
        select: {
          id: true,
          ethAddress: true,
          ensName: true,
          ensAvatarImageUrl: true,
          githubUser: {
            select: {
              id: true,
              githubId: true,
              githubHandle: true,
              githubOAuthToken: true,
            },
          },
          email: {
            select: {
              id: true,
              isValidated: true,
            },
          },
        },
      },
    },
  });
}
