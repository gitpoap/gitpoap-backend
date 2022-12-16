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
  authTokenId: number;
  addressId: number;
  address: string;
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
    payload &&
    'authTokenId' in payload &&
    typeof payload.authTokenId === 'number' &&
    'addressId' in payload &&
    typeof payload.addressId === 'number' &&
    'address' in payload &&
    typeof payload.address === 'string' &&
    'ensName' in payload &&
    isStringOrNull(payload.ensName) &&
    'ensAvatarImageUrl' in payload &&
    isStringOrNull(payload.ensAvatarImageUrl) &&
    'memberships' in payload &&
    Array.isArray(payload.memberships)
  ) {
    for (const membership of payload.memberships) {
      if (
        !(
          'teamId' in membership &&
          typeof payload.teamId === 'number' &&
          'role' in membership &&
          membershipSet.has(payload.role)
        )
      ) {
        return false;
      }
    }
  }

  return true;
}

export type AccessTokenPayload = AccessTokenPayloadBase & {
  githubId: number | null;
  githubHandle: string | null;
  discordId: string | null;
  discordHandle: string | null;
  emailId: number | null;
};

function isAccessTokenPayload(payload: any): payload is AccessTokenPayload {
  return (
    isAccessTokenPayloadBase(payload) &&
    'githubId' in payload &&
    isNumberOrNull(payload.githubId) &&
    'githubHandle' in payload &&
    isStringOrNull(payload.githubHandle) &&
    'discordId' in payload &&
    isStringOrNull(payload.discordId) &&
    'discordHandle' in payload &&
    isStringOrNull(payload.discordHandle) &&
    'emailId' in payload &&
    isNumberOrNull(payload.emailId)
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
  discordId: string | null;
  discordHandle: string | null;
  emailId: number | null;
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
    'discordId' in payload &&
    isStringOrNull(payload.discordId) &&
    'discordHandle' in payload &&
    isStringOrNull(payload.discordHandle) &&
    'emailId' in payload &&
    isNumberOrNull(payload.emailId)
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
  discordId: string | null;
  discordHandle: string | null;
  emailId: number;
};

function isAccessTokenPayloadWithEmail(payload: any): payload is AccessTokenPayloadWithEmail {
  return (
    isAccessTokenPayloadBase(payload) &&
    'githubId' in payload &&
    isNumberOrNull(payload.githubId) &&
    'githubHandle' in payload &&
    isStringOrNull(payload.githubHandle) &&
    'discordId' in payload &&
    isStringOrNull(payload.discordId) &&
    'discordHandle' in payload &&
    isStringOrNull(payload.discordHandle) &&
    'emailId' in payload &&
    typeof payload.emailId === 'number'
  );
}

export function getAccessTokenPayloadWithEmail(payload: any): AccessTokenPayloadWithEmail {
  if (isAccessTokenPayloadWithEmail(payload)) {
    return payload;
  }

  throw Error('Tried to convert payload to AccessTokenPayload but it is not!');
}

export type RefreshTokenPayload = {
  authTokenId: number;
  addressId: number;
  generation: number;
};

function isRefreshTokenPayload(payload: any): payload is RefreshTokenPayload {
  return (
    payload &&
    'authTokenId' in payload &&
    typeof payload.authTokenId === 'number' &&
    'addressId' in payload &&
    typeof payload.addressId === 'number' &&
    'generation' in payload &&
    typeof payload.generation === 'number'
  );
}

export function getRefreshTokenPayload(payload: any): RefreshTokenPayload {
  if (isRefreshTokenPayload(payload)) {
    return payload;
  }

  throw Error('Tried to convert payload to RefreshTokenPayload but it is not!');
}

export type UserAuthTokens = {
  accessToken: string;
  refreshToken: string;
};
