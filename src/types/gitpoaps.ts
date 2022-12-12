export type GitPOAPContributors = {
  githubHandles: string[];
  ethAddresses: string[];
  emails: string[];
  ensNames: string[];
};

export type GitPOAPContributorType = {
  value: string;
};

export type GitPOAPRequestEmailForm = {
  id: number;
  email: string;
  name: string;
  description: string;
  imageUrl: string;
  startDate: string;
  endDate: string;
};
export type GitPOAPRequestRejectionEmailForm = GitPOAPRequestEmailForm & {
  rejectionReason: string;
};

export enum GitPOAPRequestEmailAlias {
  RECEIVED = 'cg-received',
  REJECTED = 'cg-rejected',
  LIVE = 'cg-live',
}
