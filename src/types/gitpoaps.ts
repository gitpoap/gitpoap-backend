export type GitPOAPContributors = {
  githubHandles: string[];
  ethAddresses: string[];
  emails: string[];
  ensNames: string[];
};

export type GitPOAPContributorType = {
  value: string;
};

export type GitPOAPRequestConfirmationEmailForm = {
  email: string;
  name: string;
  description: string;
  imageUrl: string;
  startDate: string;
  endDate: string;
  contributors: GitPOAPContributorType[];
};

export type GitPOAPRequestRejectionEmailForm = {
  email: string;
};

export type GitPOAPRequestLiveEmailForm = {
  id: number;
  email: string;
  imageUrl: string;
};

export enum GitPOAPRequestEmailAlias {
  RECEIVED = 'cg-received',
  REJECTED = 'cg-rejected',
  LIVE = 'cg-live',
}
