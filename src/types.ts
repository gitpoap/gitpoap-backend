export type AccessTokenPayload = {
  authTokenId: number;
  githubId: number;
  githubHandle: string;
};

export type RefreshTokenPayload = {
  authTokenId: number;
  githubId: number;
  generation: number;
};
