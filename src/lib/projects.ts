import { Project } from '@generated/type-graphql';
import { context } from '../context';
import { createScopedLogger } from '../logging';
import { createRepoByGithubId } from './repos';

export async function createProjectWithGithubRepoIds(
  githubRepoIds: number[],
): Promise<Project | null> {
  const logger = createScopedLogger('createProjectWithGithubRepoIds');

  const project = await context.prisma.project.create({ data: {} });

  for (const id of githubRepoIds) {
    const repo = await createRepoByGithubId(id, project.id);
    if (repo === null) {
      // Rollback the project
      logger.warn(
        `Rolling back creation of Project ID ${project.id} due to issue with Repo creation`,
      );

      await context.prisma.repo.deleteMany({
        where: {
          projectId: project.id,
        },
      });

      await context.prisma.project.delete({
        where: {
          id: project.id,
        },
      });

      return null;
    }
  }

  return project;
}

export async function getOrCreateProjectWithGithubRepoId(
  githubRepoId: number,
): Promise<Project | null> {
  const logger = createScopedLogger('getOrCreateProjectWithGithubRepoId');

  const repo = await context.prisma.repo.findUnique({
    where: {
      githubRepoId,
    },
    select: {
      project: true,
    },
  });

  if (repo !== null) {
    logger.info(
      `Found Repo for GitHub repository ID ${githubRepoId} in Project ID ${repo.project.id}`,
    );
    return repo.project;
  }
  logger.debug(`No repo found for GitHub repository ID ${githubRepoId}. Attempting to create.`);

  return await createProjectWithGithubRepoIds([githubRepoId]);
}
