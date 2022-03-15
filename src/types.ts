export type AccessTokenPayload = {
  authTokenId: number;
  githubId: number;
  githubHandle: string;
};

export type AccessTokenPayloadWithOAuth = AccessTokenPayload & {
  githubOAuthToken: string;
};

export type RefreshTokenPayload = {
  authTokenId: number;
  githubId: number;
  generation: number;
};
