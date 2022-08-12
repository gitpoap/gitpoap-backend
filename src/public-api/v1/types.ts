export type GitPOAPResultType = {
  gitPoapId: number;
  gitPoapEventId: number;
  poapTokenId: string;
  poapEventId: number;
  poapEventFancyId: string;
  name: string;
  year: number;
  description: string;
  imageUrl: string;
  repositories: string[];
  earnedAt: string;
  mintedAt: string | null;
};

export type GitPOAPEventResultType = {
  gitPoapEventId: number;
  poapEventId: number;
  poapEventFancyId: string;
  name: string;
  year: number;
  description: string;
  imageUrl: string;
  repositories: string[];
  mintedCount: number;
};
