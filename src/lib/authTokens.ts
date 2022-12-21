import { context } from '../context';
import { JWT_EXP_TIME_SECONDS } from '../constants';
import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '../environment';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
  Memberships,
  UserAuthTokens,
} from '../types/authTokens';
import { createScopedLogger } from '../logging';
import { isGithubTokenValidForUser } from '../external/github';
import { isDiscordTokenValidForUser } from '../external/discord';
import { removeGithubUsersGithubOAuthToken } from '../lib/githubUsers';
import { removeDiscordUsersDiscordOAuthToken } from '../lib/discordUsers';
import { removeGithubLoginForAddress, removeDiscordLoginForAddress } from '../lib/addresses';
import { MembershipAcceptanceStatus, MembershipRole } from '@prisma/client';

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
          discordUser: {
            select: {
              id: true,
              discordId: true,
              discordHandle: true,
              discordOAuthToken: true,
            },
          },
          email: {
            select: {
              id: true,
              isValidated: true,
            },
          },
          memberships: {
            where: {
              acceptanceStatus: MembershipAcceptanceStatus.ACCEPTED,
            },
            select: {
              teamId: true,
              role: true,
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

type CheckDiscordUserType = {
  id: number;
  discordId: string;
  discordHandle: string;
  discordOAuthToken: string | null;
};

type GithubTokenData = {
  githubId: number | null;
  githubHandle: string | null;
};

type DiscordTokenData = {
  discordId: string | null;
  discordHandle: string | null;
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

async function checkDiscordTokenData(
  addressId: number,
  discordUser: CheckDiscordUserType | null,
): Promise<DiscordTokenData> {
  const logger = createScopedLogger('getTokenDataWithDiscordCheck');

  if (discordUser === null) {
    return {
      discordId: null,
      discordHandle: null,
    };
  }

  if (await isDiscordTokenValidForUser(discordUser.discordOAuthToken, discordUser.discordId)) {
    return {
      discordId: discordUser.discordId,
      discordHandle: discordUser.discordHandle,
    };
  }

  logger.info(`Removing invalid Discord OAuth token for DiscordUser ID ${discordUser.id}`);

  await removeDiscordUsersDiscordOAuthToken(discordUser.id);

  await removeDiscordLoginForAddress(addressId);

  return {
    discordId: null,
    discordHandle: null,
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
  memberships: Memberships,
  githubId: number | null,
  githubHandle: string | null,
  discordId: string | null,
  discordHandle: string | null,
  emailId: number | null,
): UserAuthTokens {
  const accessTokenPayload: AccessTokenPayload = {
    authTokenId,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    memberships,
    githubId,
    githubHandle,
    discordId,
    discordHandle,
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
  memberships: Memberships;
  githubUser: CheckGithubUserType | null;
  discordUser: CheckDiscordUserType | null;
  email: CheckEmailType | null;
};

export async function generateAuthTokensWithChecks(
  authTokenId: number,
  generation: number,
  address: CheckAddressType,
): Promise<UserAuthTokens> {
  const { githubId, githubHandle } = await checkGithubTokenData(address.id, address.githubUser);
  const { discordId, discordHandle } = await checkDiscordTokenData(address.id, address.discordUser);

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
    address.memberships,
    githubId,
    githubHandle,
    discordId,
    discordHandle,
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
          discordUser: {
            select: {
              id: true,
              discordId: true,
              discordHandle: true,
              discordOAuthToken: true,
            },
          },
          email: {
            select: {
              id: true,
              isValidated: true,
            },
          },
          memberships: {
            where: {
              acceptanceStatus: MembershipAcceptanceStatus.ACCEPTED,
            },
            select: {
              teamId: true,
              role: true,
            },
          },
        },
      },
    },
  });
}

type ValidatedAccessTokenPayload = {
  ensName: string | null;
  ensAvatarImageUrl: string | null;
  memberships: Memberships;
  githubId: number | null;
  githubHandle: string | null;
  githubOAuthToken: string | null;
  discordId: string | null;
  discordHandle: string | null;
  emailId: number | null;
};

export async function getValidatedAccessTokenPayload(
  authTokenId: number,
): Promise<ValidatedAccessTokenPayload | null> {
  const tokenInfo = await context.prisma.authToken.findUnique({
    where: { id: authTokenId },
    select: {
      id: true,
      address: {
        select: {
          ensName: true,
          ensAvatarImageUrl: true,
          githubUser: {
            select: {
              githubId: true,
              githubHandle: true,
              githubOAuthToken: true,
            },
          },
          discordUser: {
            select: {
              discordId: true,
              discordHandle: true,
            },
          },
          email: {
            select: {
              id: true,
              isValidated: true,
            },
          },
          memberships: {
            where: {
              acceptanceStatus: MembershipAcceptanceStatus.ACCEPTED,
            },
            select: {
              teamId: true,
              role: true,
            },
          },
        },
      },
    },
  });
  if (tokenInfo === null) {
    return null;
  }

  let emailId: number | null = null;
  if (tokenInfo.address.email !== null) {
    emailId = tokenInfo.address.email.isValidated ? tokenInfo.address.email.id : null;
  }

  return {
    ensName: tokenInfo.address.ensName,
    ensAvatarImageUrl: tokenInfo.address.ensAvatarImageUrl,
    memberships: tokenInfo.address.memberships,
    githubId: tokenInfo.address.githubUser?.githubId ?? null,
    githubHandle: tokenInfo.address.githubUser?.githubHandle ?? null,
    githubOAuthToken: tokenInfo.address.githubUser?.githubOAuthToken ?? null,
    discordId: tokenInfo.address.discordUser?.discordId ?? null,
    discordHandle: tokenInfo.address.discordUser?.discordHandle ?? null,
    emailId,
  };
}

export function hasMembership(
  accessTokenPayload: AccessTokenPayload,
  teamId: number,
  roles?: MembershipRole[],
) {
  const acceptedRoles = new Set<MembershipRole>(roles ?? []);

  return accessTokenPayload.memberships.some(
    membership =>
      membership.teamId === teamId && (roles === undefined || acceptedRoles.has(membership.role)),
  );
}
