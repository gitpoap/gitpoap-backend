export type GitPOAPContributors = {
  githubHandles: string[];
  ethAddresses: string[];
  emails: string[];
  ensNames: string[];
};

export type CGRequestEmailForm = {
  email: string;
  name: string;
  description: string;
  imageKey: string;
  organizationName: string | null;
  organizationId: number | null;
};

export enum CGRequestEmailAlias {
  RECEIVED = 'cg-received',
  REJECTED = 'cg-rejected',
  LIVE = 'cg-live',
}
