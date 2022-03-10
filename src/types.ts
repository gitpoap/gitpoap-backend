export type AccessTokenPayload = {
  authTokenId: number;
  githubId: number;
};

export type RefreshTokenPayload = {
  authTokenId: number;
  githubId: number;
  generation: number;
};
