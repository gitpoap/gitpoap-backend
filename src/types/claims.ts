export type FoundClaim = {
  claimId: number;
  gitPOAPId: number;
  gitPOAPName: string;
  githubUser: {
    githubHandle: string;
  } | null;
};

export type ClaimData = {
  id: number;
  githubUser: {
    githubId: number;
    githubHandle: string;
  } | null;
  gitPOAP: {
    id: number;
    name: string;
    imageUrl: string;
    description: string;
    threshold: number;
  };
};
