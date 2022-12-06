import { context } from '../context';

export const upsertGithubOrganization = async (githubOrgId: number, name: string) => {
  return await context.prisma.githubOrganization.upsert({
    where: {
      githubOrgId,
    },
    update: {},
    create: {
      githubOrgId,
      name,
    },
  });
};
