export const generateS3ImageUrl = (imageKey: string): string => {
  return `https://s3.us-east-2.amazonaws.com/${imageKey}`;
};

export const generateOrganizationLink = (orgId: number): string => {
  return `https://www.gitpoap.io/org/${orgId}`;
};

export const generateGitPOAPRequestLink = (cgId: number): string => {
  // need to update
  return `https://www.gitpoap.io/org/${cgId}`;
};
