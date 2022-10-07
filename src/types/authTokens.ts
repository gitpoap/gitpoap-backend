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
};

function isAccessTokenPayload(payload: any): payload is AccessTokenPayload {
  return (
    isAccessTokenPayloadBase(payload) &&
    'githubId' in payload &&
    isNumberOrNull(payload.githubId) &&
    'githubHandle' in payload &&
    isStringOrNull(payload.githubHandle)
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
};

function isAccessTokenPayloadWithOAuth(payload: any): payload is AccessTokenPayloadWithOAuth {
  return (
    isAccessTokenPayloadBase(payload) &&
    'githubId' in payload &&
    typeof payload.githubId === 'number' &&
    'githubHandle' in payload &&
    typeof payload.githubHandle === 'string' &&
    'githubOAuthToken' in payload &&
    typeof payload.githubOAuthToken === 'string'
  );
}

export function getAccessTokenPayloadWithOAuth(payload: any): AccessTokenPayloadWithOAuth {
  if (isAccessTokenPayloadWithOAuth(payload)) {
    return payload;
  }

  throw Error('Tried to convert payload to AccessTokenPayloadWithOAuth but it is not!');
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