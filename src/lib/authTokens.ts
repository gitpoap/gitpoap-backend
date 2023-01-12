import { context } from '../context';
import { JWT_EXP_TIME_SECONDS } from '../constants';
import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '../environment';
import { AccessTokenPayload, Memberships, UserAuthTokens } from '../types/authTokens';
import { createScopedLogger } from '../logging';
import { isGithubTokenValidForUser } from '../external/github';
import { isDiscordTokenValidForUser } from '../external/discord';
import { removeGithubUsersGithubOAuthToken } from '../lib/githubUsers';
import { removeDiscordUsersDiscordOAuthToken } from '../lib/discordUsers';
import { removeGithubLoginForAddress, removeDiscordLoginForAddress } from '../lib/addresses';
import { MembershipAcceptanceStatus, MembershipRole } from '@prisma/client';

async function retrieveAddressData(addressId: number) {
  return await context.prisma.address.findUnique({
    where: { id: addressId },
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

export function generateAuthTokens(
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

  return {
    accessToken: generateAccessToken(accessTokenPayload),
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

async function generateAuthTokensWithChecks(address: CheckAddressType): Promise<UserAuthTokens> {
  const { githubId, githubHandle } = await checkGithubTokenData(address.id, address.githubUser);
  const { discordId, discordHandle } = await checkDiscordTokenData(address.id, address.discordUser);

  let emailId: number | null = null;
  if (address.email !== null) {
    emailId = address.email.isValidated ? address.email.id : null;
  }

  return generateAuthTokens(
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

export async function generateNewAuthTokens(addressId: number): Promise<UserAuthTokens | null> {
  const logger = createScopedLogger('generateNewAuthTokens');

  const address = await retrieveAddressData(addressId);
  if (address === null) {
    logger.error(`Failed to lookup known Address ID ${addressId}`);
    return null;
  }

  return generateAuthTokensWithChecks(address);
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
  addressId: number,
): Promise<ValidatedAccessTokenPayload | null> {
  const logger = createScopedLogger('getValidatedAccessTokenPayload');

  const addressData = await retrieveAddressData(addressId);
  if (addressData === null) {
    logger.error(`Failed to lookup known Address ID ${addressId}`);
    return null;
  }

  let emailId: number | null = null;
  if (addressData.email !== null) {
    emailId = addressData.email.isValidated ? addressData.email.id : null;
  }

  return {
    ensName: addressData.ensName,
    ensAvatarImageUrl: addressData.ensAvatarImageUrl,
    memberships: addressData.memberships,
    githubId: addressData.githubUser?.githubId ?? null,
    githubHandle: addressData.githubUser?.githubHandle ?? null,
    githubOAuthToken: addressData.githubUser?.githubOAuthToken ?? null,
    discordId: addressData.discordUser?.discordId ?? null,
    discordHandle: addressData.discordUser?.discordHandle ?? null,
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
