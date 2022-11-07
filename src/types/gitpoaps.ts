export type GitPOAPContributors = {
  githubHandles: string[];
  ethAddresses: string[];
  emails: string[];
  ensNames: string[];
};

export type GitPOAPRequestEmailForm = {
  id: number;
  email: string;
  name: string;
  description: string;
  imageUrl: string;
  organizationName: string | null;
  organizationId: number | null;
};

export enum GitPOAPRequestEmailAlias {
  RECEIVED = 'cg-received',
  REJECTED = 'cg-rejected',
  LIVE = 'cg-live',
}
