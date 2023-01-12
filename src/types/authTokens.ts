import { MembershipRole } from '@prisma/client';

function isNumberOrNull(field: any): boolean {
  return typeof field === 'number' || field === null;
}

function isStringOrNull(field: any): boolean {
  return typeof field === 'string' || field === null;
}

export type Memberships = {
  teamId: number;
  role: MembershipRole;
}[];

type AccessTokenPayloadBase = {
  addressId: number;
  ethAddress: string;
  ensName: string | null;
  ensAvatarImageUrl: string | null;
  memberships: Memberships;
};

const membershipSet = new Set<MembershipRole>([
  MembershipRole.ADMIN,
  MembershipRole.OWNER,
  MembershipRole.MEMBER,
]);

function isAccessTokenPayloadBase(payload: any): boolean {
  if (
    !(
      payload &&
      typeof payload === 'object' &&
      'addressId' in payload &&
      typeof payload.addressId === 'number' &&
      'ethAddress' in payload &&
      typeof payload.ethAddress === 'string' &&
      'ensName' in payload &&
      isStringOrNull(payload.ensName) &&
      'ensAvatarImageUrl' in payload &&
      isStringOrNull(payload.ensAvatarImageUrl) &&
      'memberships' in payload &&
      Array.isArray(payload.memberships)
    )
  ) {
    return false;
  }
  for (const membership of payload.memberships) {
    if (
      !(
        membership &&
        typeof membership === 'object' &&
        'teamId' in membership &&
        typeof membership.teamId === 'number' &&
        'role' in membership &&
        membershipSet.has(membership.role)
      )
    ) {
      return false;
    }
  }

  return true;
}

export type AccessTokenPayload = AccessTokenPayloadBase & {
  githubId: number | null;
  githubHandle: string | null;
  discordHandle: string | null;
  emailAddress: string | null;
};

function isAccessTokenPayload(payload: any): payload is AccessTokenPayload {
  return (
    isAccessTokenPayloadBase(payload) &&
    'githubId' in payload &&
    isNumberOrNull(payload.githubId) &&
    'githubHandle' in payload &&
    isStringOrNull(payload.githubHandle) &&
    'discordHandle' in payload &&
    isStringOrNull(payload.discordHandle) &&
    'emailAddress' in payload &&
    isStringOrNull(payload.emailAddress)
  );
}

export function getAccessTokenPayload(payload: any): AccessTokenPayload {
  if (isAccessTokenPayload(payload)) {
    return payload;
  }

  throw Error('Tried to convert payload to AccessTokenPayload but it is not!');
}

export type AccessTokenPayloadWithGithubOAuth = AccessTokenPayloadBase & {
  githubId: number;
  githubHandle: string;
  githubOAuthToken: string;
  discordHandle: string | null;
  emailAddress: string | null;
};

function isAccessTokenPayloadWithGithubOAuth(
  payload: any,
): payload is AccessTokenPayloadWithGithubOAuth {
  return (
    isAccessTokenPayloadBase(payload) &&
    'githubId' in payload &&
    typeof payload.githubId === 'number' &&
    'githubHandle' in payload &&
    typeof payload.githubHandle === 'string' &&
    'githubOAuthToken' in payload &&
    typeof payload.githubOAuthToken === 'string' &&
    'discordHandle' in payload &&
    isStringOrNull(payload.discordHandle) &&
    'emailAddress' in payload &&
    isStringOrNull(payload.emailAddress)
  );
}

export function getAccessTokenPayloadWithGithubOAuth(
  payload: any,
): AccessTokenPayloadWithGithubOAuth {
  if (isAccessTokenPayloadWithGithubOAuth(payload)) {
    return payload;
  }

  throw Error('Tried to convert payload to AccessTokenPayloadWithGithubOAuth but it is not!');
}

export type AccessTokenPayloadWithEmail = AccessTokenPayloadBase & {
  githubId: number | null;
  githubHandle: string | null;
  discordHandle: string | null;
  emailAddress: string;
};

function isAccessTokenPayloadWithEmail(payload: any): payload is AccessTokenPayloadWithEmail {
  return (
    isAccessTokenPayloadBase(payload) &&
    'githubId' in payload &&
    isNumberOrNull(payload.githubId) &&
    'githubHandle' in payload &&
    isStringOrNull(payload.githubHandle) &&
    'discordHandle' in payload &&
    isStringOrNull(payload.discordHandle) &&
    'emailAddress' in payload &&
    typeof payload.emailAddress === 'string'
  );
}

export function getAccessTokenPayloadWithEmail(payload: any): AccessTokenPayloadWithEmail {
  if (isAccessTokenPayloadWithEmail(payload)) {
    return payload;
  }

  throw Error('Tried to convert payload to AccessTokenPayload but it is not!');
}

export type UserAuthTokens = {
  accessToken: string;
};
