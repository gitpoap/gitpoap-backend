import { context } from '../context';
import { JWT_EXP_TIME_SECONDS } from '../constants';
import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '../environment';
import { AccessTokenPayload, Memberships, UserAuthTokens } from '../types/authTokens';
import { createScopedLogger } from '../logging';
import { isGithubTokenValidForUser } from '../external/github';
import { removeGithubUsersGithubOAuthToken } from '../lib/githubUsers';
import { removeGithubLoginForAddress } from '../lib/addresses';
import { MembershipAcceptanceStatus, MembershipRole } from '@prisma/client';
import { PrivyUserData } from '../lib/privy';

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

export function generateAuthTokens(
  addressId: number,
  ethAddress: string,
  ensName: string | null,
  ensAvatarImageUrl: string | null,
  memberships: Memberships,
  githubId: number | null,
  githubHandle: string | null,
  discordHandle: string | null,
  emailAddress: string | null,
): UserAuthTokens {
  const accessTokenPayload: AccessTokenPayload = {
    addressId,
    ethAddress,
    ensName,
    ensAvatarImageUrl,
    memberships,
    githubId,
    githubHandle,
    discordHandle,
    emailAddress,
  };

  return {
    accessToken: generateAccessToken(accessTokenPayload),
  };
}

type CheckAddressType = {
  id: number;
  ethAddress: string;
  ensName: string | null;
  ensAvatarImageUrl: string | null;
  memberships: Memberships;
  githubUser: CheckGithubUserType | null;
};

async function generateAuthTokensWithChecks(
  address: CheckAddressType,
  discordHandle: string | null,
  emailAddress: string | null,
): Promise<UserAuthTokens> {
  const { githubId, githubHandle } = await checkGithubTokenData(address.id, address.githubUser);

  return generateAuthTokens(
    address.id,
    address.ethAddress,
    address.ensName,
    address.ensAvatarImageUrl,
    address.memberships,
    githubId,
    githubHandle,
    discordHandle,
    emailAddress,
  );
}

export async function generateNewAuthTokens(
  privyUserData: PrivyUserData,
): Promise<UserAuthTokens | null> {
  const logger = createScopedLogger('generateNewAuthTokens');

  const address = await retrieveAddressData(privyUserData.addressId);
  if (address === null) {
    logger.error(`Failed to lookup known Address ID ${privyUserData.addressId}`);
    return null;
  }

  return generateAuthTokensWithChecks(
    address,
    privyUserData.discordHandle,
    privyUserData.emailAddress,
  );
}

type ValidatedAccessTokenPayload = {
  ensName: string | null;
  ensAvatarImageUrl: string | null;
  memberships: Memberships;
  githubId: number | null;
  githubHandle: string | null;
  githubOAuthToken: string | null;
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

  return {
    ensName: addressData.ensName,
    ensAvatarImageUrl: addressData.ensAvatarImageUrl,
    memberships: addressData.memberships,
    githubId: addressData.githubUser?.githubId ?? null,
    githubHandle: addressData.githubUser?.githubHandle ?? null,
    githubOAuthToken: addressData.githubUser?.githubOAuthToken ?? null,
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
