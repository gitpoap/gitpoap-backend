import { context } from '../context';
import { createScopedLogger } from '../logging';

export async function upsertGithubUser(
  githubId: number,
  githubHandle: string,
  githubOAuthToken?: string,
) {
  const logger = createScopedLogger('upsertGithubUser');

  logger.info(`Attempting to upsert GitHub user ${githubHandle}`);

  return await context.prisma.githubUser.upsert({
    where: {
      githubId,
    },
    update: {
      githubHandle,
      githubOAuthToken,
    },
    create: {
      githubId,
      githubHandle,
      githubOAuthToken,
    },
  });
}

export async function removeGithubUsersGithubOAuthToken(githubUserId: number) {
  await context.prisma.githubUser.update({
    where: {
      id: githubUserId,
    },
    data: {
      githubOAuthToken: null,
    },
  });
}
