import { context } from '../context';
import { createScopedLogger } from '../logging';

export async function upsertUser(
  githubId: number,
  githubHandle: string,
  githubOAuthToken?: string,
) {
  const logger = createScopedLogger('upsertUser');

  logger.info(`Attempting to upsert GitHub user ${githubHandle}`);

  return await context.prisma.user.upsert({
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

export async function removeUsersGithubOAuthToken(userId: number) {
  await context.prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      githubOAuthToken: null,
    },
  });
}
