import { Project } from '@generated/type-graphql';
import { context } from '../context';
import { createScopedLogger } from '../logging';
import { createRepoByGithubId } from './repos';

export async function createProjectWithGithubRepoIds(
  githubRepoIds: number[],
  githubOAuthToken: string,
): Promise<Project | null> {
  const logger = createScopedLogger('createProjectWithGithubRepoIds');

  const project = await context.prisma.project.create({ data: {} });

  for (const id of githubRepoIds) {
    const repo = createRepoByGithubId(id, project.id, githubOAuthToken);
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
