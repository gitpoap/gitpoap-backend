import { MembershipRole } from '@prisma/client';

function isStringOrNull(field: any): boolean {
  return typeof field === 'string' || field === null;
}

function isObjectWithId(payload: any): boolean {
  return (
    payload && typeof payload === 'object' && 'id' in payload && typeof payload.id === 'number'
  );
}

export type AddressPayload = {
  id: number;
  ethAddress: string;
  ensName: string | null;
  ensAvatarImageUrl: string | null;
};

function isAddressPayload(payload: any): payload is AddressPayload {
  return (
    isObjectWithId(payload) &&
    'ethAddress' in payload &&
    typeof payload.ethAddress === 'string' &&
    'ensName' in payload &&
    isStringOrNull(payload.ensName) &&
    'ensAvatarImageUrl' in payload &&
    isStringOrNull(payload.ensAvatarImageUrl)
  );
}

export type GithubPayload = {
  id: number;
  githubId: number;
  githubHandle: string;
};

function isGithubPayload(payload: any): payload is GithubPayload {
  return (
    isObjectWithId(payload) &&
    'githubId' in payload &&
    typeof payload.githubId === 'number' &&
    'githubHandle' in payload &&
    typeof payload.githubHandle === 'string'
  );
}

export type EmailPayload = {
  id: number;
  emailAddress: string;
};

function isEmailPayload(payload: any): payload is EmailPayload {
  return (
    isObjectWithId(payload) && 'emailAddress' in payload && typeof payload.emailAddress === 'string'
  );
}

export type DiscordPayload = {
  id: number;
  discordId: string;
  discordHandle: string;
};

function isDiscordPayload(payload: any): payload is DiscordPayload {
  return (
    isObjectWithId(payload) &&
    'discordId' in payload &&
    typeof payload.discordId === 'string' &&
    'discordHandle' in payload &&
    typeof payload.discordHandle === 'string'
  );
}

export type MembershipPayload = {
  teamId: number;
  role: MembershipRole;
};

const membershipSet = new Set<MembershipRole>([
  MembershipRole.ADMIN,
  MembershipRole.OWNER,
  MembershipRole.MEMBER,
]);

function isMembershipPayload(payload: any): payload is MembershipPayload {
  return (
    payload &&
    typeof payload === 'object' &&
    'teamId' in payload &&
    typeof payload.teamId === 'number' &&
    'role' in payload &&
    membershipSet.has(payload.role)
  );
}

export type MembershipsPayload = MembershipPayload[];

function isMembershipsPayload(payload: any): payload is MembershipsPayload {
  if (!(payload && Array.isArray(payload))) {
    return false;
  }

  for (const membership of payload) {
    if (!isMembershipPayload(membership)) {
      return false;
    }
  }

  return true;
}

export type AccessTokenPayload = {
  privyUserId: string;
  address: AddressPayload | null;
  github: GithubPayload | null;
  email: EmailPayload | null;
  discord: DiscordPayload | null;
  memberships: MembershipsPayload;
};

function isAccessTokenPayload(payload: any): payload is AccessTokenPayload {
  return (
    payload &&
    typeof payload === 'object' &&
    'privyUserId' in payload &&
    typeof payload.privyUserId === 'string' &&
    'address' in payload &&
    (payload.address === null || isAddressPayload(payload.address)) &&
    'github' in payload &&
    (payload.github === null || isGithubPayload(payload.github)) &&
    'email' in payload &&
    (payload.email === null || isEmailPayload(payload.email)) &&
    'discord' in payload &&
    (payload.discord === null || isDiscordPayload(payload.discord)) &&
    'memberships' in payload &&
    isMembershipsPayload(payload.memberships)
  );
}

export function getAccessTokenPayload(payload: any): AccessTokenPayload {
  if (isAccessTokenPayload(payload)) {
    return payload;
  }

  throw Error('Tried to convert payload to AccessTokenPayload but it is not!');
}

export type AccessTokenPayloadWithAddress = AccessTokenPayload & {
  address: AddressPayload;
};

function isAccessTokenPayloadWithAddress(payload: any): payload is AccessTokenPayloadWithAddress {
  return isAccessTokenPayload(payload) && payload.address !== null;
}

export function getAccessTokenPayloadWithAddress(payload: any): AccessTokenPayloadWithAddress {
  if (isAccessTokenPayloadWithAddress(payload)) {
    return payload;
  }

  throw Error('Tried to convert payload to AccessTokenPayloadWithAddress but it is not!');
}

export type AccessTokenPayloadWithGithub = AccessTokenPayload & {
  github: GithubPayload;
};

function isAccessTokenPayloadWithGithub(payload: any): payload is AccessTokenPayloadWithGithub {
  return isAccessTokenPayload(payload) && payload.github !== null;
}

export function getAccessTokenPayloadWithGithub(payload: any): AccessTokenPayloadWithGithub {
  if (isAccessTokenPayloadWithGithub(payload)) {
    return payload;
  }

  throw Error('Tried to convert payload to AccessTokenPayloadWithGithub but it is not!');
}

export type UserAuthTokens = {
  accessToken: string;
};
