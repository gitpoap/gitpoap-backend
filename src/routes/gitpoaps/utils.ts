import { GITPOAP_ROOT_URL, AWS_S3_ROOT_URL } from '../../environment';

export const generateS3ImageUrl = (imageKey: string): string => {
  return `${AWS_S3_ROOT_URL}/${imageKey}`;
};

export const generateOrganizationLink = (orgId: number): string => {
  return `${GITPOAP_ROOT_URL}/org/${orgId}`;
};

export const generateGitPOAPRequestLink = (customGitPOAPId: number): string => {
  // need to update
  return `${GITPOAP_ROOT_URL}/org/${customGitPOAPId}`;
};
