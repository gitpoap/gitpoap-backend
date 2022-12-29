import { createScopedLogger } from '../logging';
import { context } from '../context';
import { RepoData } from './claims';
import { GitPOAPStatus, Repo } from '@generated/type-graphql';
import { getGithubRepository, getGithubRepositoryById, OctokitRepoItem } from '../external/github';
import { upsertGithubOrganization } from './githubOrganizations';

async function createRepoHelper(
  repoInfo: OctokitRepoItem,
  projectId: number,
): Promise<Repo | null> {
  const logger = createScopedLogger('createRepoHelper');

  // Add the github org if it doesn't already exist
  const org = await upsertGithubOrganization(repoInfo.owner.id, repoInfo.owner.login);

  try {
    return await context.prisma.repo.create({
      data: {
        githubRepoId: repoInfo.id,
        name: repoInfo.name,
        organization: {
          connect: {
            id: org.id,
          },
        },
        project: {
          connect: {
            id: projectId,
          },
        },
      },
    });
  } catch (err) {
    logger.error(
      `Failed to create repo "${repoInfo.owner.login}/${repoInfo.name}" for Project ID ${projectId}`,
    );
    return null;
  }
}

export async function createRepo(
  organization: string,
  repository: string,
  projectId: number,
  githubOAuthToken: string,
): Promise<Repo | null> {
  const logger = createScopedLogger('createRepo');

  logger.info(
    `Creating Repo ${organization}/${repository} in project ID ${projectId} if it doesn't exist`,
  );

  const repoInfo = await getGithubRepository(organization, repository, githubOAuthToken);
  if (repoInfo === null) {
    logger.warn(`Couldn't find ${organization}/${repository} on GitHub`);
    return null;
  }

  return await createRepoHelper(repoInfo, projectId);
}

export async function createRepoByGithubId(
  githubRepoId: number,
  projectId: number,
  githubOAuthToken: string,
): Promise<Repo | null> {
  const logger = createScopedLogger('createRepoByGithubId');

  logger.info(
    `Creating Repo for GitHub repository ID ${githubRepoId} in project ID ${projectId} if it doesn't exist`,
  );

  const repoInfo = await getGithubRepositoryById(githubRepoId, githubOAuthToken);
  if (repoInfo === null) {
    logger.warn(`Couldn't find repository ID ${githubRepoId} on GitHub`);
    return null;
  }

  return await createRepoHelper(repoInfo, projectId);
}

export async function getRepoByName(
  owner: string,
  repo: string,
  isPRBased?: boolean,
): Promise<RepoData | null> {
  const logger = createScopedLogger('getRepoByName');

  const result = await context.prisma.repo.findMany({
    where: {
      name: repo,
      organization: {
        name: owner,
      },
    },
    select: {
      id: true,
      project: {
        select: {
          gitPOAPs: {
            where: {
              isPRBased,
              NOT: {
                poapApprovalStatus: GitPOAPStatus.DEPRECATED,
              },
            },
            select: {
              id: true,
              year: true,
              threshold: true,
              isPRBased: true,
            },
          },
          repos: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (result.length === 0) {
    logger.warn(`Couldn't find any repos in the DB named "${owner}/${repo}"`);
    return null;
  } else if (result.length > 1) {
    logger.warn(`Found multiple repos in DB named "${owner}/${repo}"`);
    return null;
  }

  return result[0];
}
