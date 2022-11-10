import { Prisma } from '@prisma/client';
import { GitPOAPContributors, GitPOAPContributorType } from '../../types/gitpoaps';
import { GITPOAP_ROOT_URL } from '../../constants';

export const generateOrganizationLink = (orgId: number): string => {
  return `${GITPOAP_ROOT_URL}/org/${orgId}`;
};

export const generateGitPOAPRequestLink = (customGitPOAPId: number): string => {
  return `${GITPOAP_ROOT_URL}/me/requests?search=${customGitPOAPId}`;
};

export const genereateContributorsForEmail = (
  gitPOAPContributors: Prisma.JsonValue,
): GitPOAPContributorType[] => {
  if (!gitPOAPContributors) return [];

  const contributors: GitPOAPContributors = gitPOAPContributors as GitPOAPContributors;
  let result: GitPOAPContributorType[] = [];

  const githubHandles: GitPOAPContributorType[] =
    contributors.githubHandles?.map((contributor: string) => ({
      value: contributor,
    })) ?? [];
  const ethAddresses: GitPOAPContributorType[] =
    contributors.ethAddresses?.map((contributor: string) => ({
      value: contributor,
    })) ?? [];
  const emails: GitPOAPContributorType[] =
    contributors.emails?.map((contributor: string) => ({
      value: contributor,
    })) ?? [];
  const ensNames: GitPOAPContributorType[] =
    contributors.ensNames?.map((contributor: string) => ({
      value: contributor,
    })) ?? [];
  result = [...githubHandles, ...ethAddresses, ...emails, ...ensNames];

  return result;
};
