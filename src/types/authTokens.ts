function isNumberOrNull(field: any): boolean {
  return typeof field === 'number' || field === null;
}

function isStringOrNull(field: any): boolean {
  return typeof field === 'string' || field === null;
}

type AccessTokenPayloadBase = {
  authTokenId: number;
  addressId: number;
  address: string;
  ensName: string | null;
  ensAvatarImageUrl: string | null;
};

function isAccessTokenPayloadBase(payload: any): boolean {
  return (
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
    isStringOrNull(payload.ensAvatarImageUrl)
  );
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

export type AccessTokenPayloadWithOAuth = AccessTokenPayloadBase & {
  githubId: number;
  githubHandle: string;
  githubOAuthToken: string;
  discordId: string;
  discordHandle: string;
  discordOAuthToken: string;
  emailId: number | null;
};

function isAccessTokenPayloadWithOAuth(payload: any): payload is AccessTokenPayloadWithOAuth {
  return (
    isAccessTokenPayloadBase(payload) &&
    'githubId' in payload &&
    typeof payload.githubId === 'number' &&
    'githubHandle' in payload &&
    typeof payload.githubHandle === 'string' &&
    'githubOAuthToken' in payload &&
    typeof payload.githubOAuthToken === 'string' &&
    'discordId' in payload &&
    typeof payload.discordId === 'string' &&
    'discordHandle' in payload &&
    typeof payload.discordHandle === 'string' &&
    'discordOAuthToken' in payload &&
    typeof payload.discordOAuthToken === 'string' &&
    'emailId' in payload &&
    isNumberOrNull(payload.emailId)
  );
}

export function getAccessTokenPayloadWithOAuth(payload: any): AccessTokenPayloadWithOAuth {
  if (isAccessTokenPayloadWithOAuth(payload)) {
    return payload;
  }

  throw Error('Tried to convert payload to AccessTokenPayloadWithOAuth but it is not!');
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
