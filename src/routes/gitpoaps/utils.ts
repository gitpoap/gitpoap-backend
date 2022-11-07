import { GITPOAP_ROOT_URL } from '../../constants';

export const generateOrganizationLink = (orgId: number): string => {
  return `${GITPOAP_ROOT_URL}/org/${orgId}`;
};

export const generateGitPOAPRequestLink = (customGitPOAPId: number): string => {
  return `${GITPOAP_ROOT_URL}/me/requests?search=${customGitPOAPId}`;
};
