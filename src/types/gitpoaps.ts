export type CGRequestEmailForm = {
  email: string;
  name: string;
  description: string;
  imageKey: string;
  organizationName?: string;
  organizationId?: number;
};

export type GitPOAPContributors = {
  githubHandles: string[];
  ethAddresses: string[];
  emails: string[];
  ensNames: string[];
};
