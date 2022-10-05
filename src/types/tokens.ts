export type AccessTokenPayload = {
  authTokenId: number;
  addressId: number;
  address: string;
  ensName: string | null;
  ensAvatarImageUrl: string | null;
  githubId: number | null;
  githubHandle: string | null;
};

export type AccessTokenPayloadWithOAuth = AccessTokenPayload & {
  githubId: number;
  githubHandle: string;
  githubOAuthToken: string;
};

export type RefreshTokenPayload = {
  authTokenId: number;
  addressId: number;
  generation: number;
};
