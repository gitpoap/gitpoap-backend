import { context } from '../context';
import { JWT_EXP_TIME_SECONDS } from '../constants';
import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '../environment';
import { AccessTokenPayload, Memberships, UserAuthTokens } from '../types/authTokens';
import { createScopedLogger } from '../logging';
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

function generateAccessToken(payload: AccessTokenPayload): string {
  return sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXP_TIME_SECONDS,
  });
}

export function generateAuthTokens(
  privyUserId: string,
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
  };

  return {
    accessToken: generateAccessToken(accessTokenPayload),
  };
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

  return generateAuthTokens(
    privyUserData.privyUserId,
    address.id,
    address.ethAddress,
    address.ensName,
    address.ensAvatarImageUrl,
    address.memberships,
    privyUserData.githubUser?.githubId ?? null,
    privyUserData.githubUser?.githubHandle ?? null,
    privyUserData.discordHandle,
    privyUserData.emailAddress,
  );
}

type ValidatedAccessTokenPayload = {
  ensName: string | null;
  ensAvatarImageUrl: string | null;
  memberships: Memberships;
};

export async function getValidatedAccessTokenPayload(
  privyUserId: string,
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
