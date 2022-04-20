import { Repo } from '@generated/type-graphql';
import { context } from '../context';
import { createScopedLogger } from '../logging';
import {
  GithubRepoResponse,
  getGithubRepository,
  getGithubRepositoryById,
} from '../external/github';

async function upsertProjectHelper(repoInfo: GithubRepoResponse): Promise<Repo> {
  // Add the org if it doesn't already exist
  const org = await context.prisma.organization.upsert({
    where: {
      githubOrgId: repoInfo.owner.id,
    },
    update: {},
    create: {
      githubOrgId: repoInfo.owner.id,
      name: repoInfo.owner.login,
    },
  });

  return await context.prisma.repo.upsert({
    where: {
      githubRepoId: repoInfo.id,
    },
    update: {},
    create: {
      githubRepoId: repoInfo.id,
      name: repoInfo.name,
      organizationId: org.id,
    },
  });
}

export async function upsertProject(
  organization: string,
  repository: string,
  githubOAuthToken: string,
): Promise<Repo | null> {
  const logger = createScopedLogger('upsertProject');

  logger.info(`Creating project ${organization}/${repository} if it doesn't exist`);

  const repoInfo = await getGithubRepository(organization, repository, githubOAuthToken);
  if (repoInfo === null) {
    logger.warn(`Couldn't find ${organization}/${repository} on GitHub`);
    return null;
  }

  return await upsertProjectHelper(repoInfo);
}

export async function upsertProjectById(
  githubRepoId: number,
  githubOAuthToken: string,
): Promise<Repo | null> {
  const logger = createScopedLogger('upsertProjectById');

  logger.info(`Creating project for GitHub repo ID ${githubRepoId} if it doesn't exist`);

  const repoInfo = await getGithubRepositoryById(githubRepoId, githubOAuthToken);
  if (repoInfo === null) {
    logger.warn(`Couldn't find repository ID ${githubRepoId} on GitHub`);
    return null;
  }
  return await upsertProjectHelper(repoInfo);
}
