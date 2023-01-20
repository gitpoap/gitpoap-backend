import { context } from '../context';
import { JWT_EXP_TIME_SECONDS } from '../constants';
import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '../environment';
import {
  AccessTokenPayload,
  AddressPayload,
  DiscordPayload,
  EmailPayload,
  GithubPayload,
  MembershipsPayload,
  UserAuthTokens,
} from '../types/authTokens';
import { MembershipAcceptanceStatus, MembershipRole } from '@prisma/client';
import { PrivyUserData } from '../lib/privy';

function generateAccessToken(payload: AccessTokenPayload): string {
  return sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXP_TIME_SECONDS,
  });
}

export function generateAuthTokens(
  privyUserId: string,
  address: AddressPayload | null,
  github: GithubPayload | null,
  email: EmailPayload | null,
  discord: DiscordPayload | null,
  memberships: MembershipsPayload,
): UserAuthTokens {
  const accessTokenPayload: AccessTokenPayload = {
    privyUserId,
    address,
    github,
    email,
    discord,
    memberships,
  };

  return {
    accessToken: generateAccessToken(accessTokenPayload),
  };
}

async function retrieveMemberships(address: AddressPayload | null): Promise<MembershipsPayload> {
  if (address === null) {
    return [];
  }

  const membershipData = await context.prisma.address.findUnique({
    where: { id: address.id },
    select: {
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

  return membershipData?.memberships ?? [];
}

export async function generateNewAuthTokens(privyUserData: PrivyUserData): Promise<UserAuthTokens> {
  const memberships = await retrieveMemberships(privyUserData.address);

  return generateAuthTokens(
    privyUserData.privyUserId,
    privyUserData.address,
    privyUserData.github,
    privyUserData.email,
    privyUserData.discord,
    memberships,
  );
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
