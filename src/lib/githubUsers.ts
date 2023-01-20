import { context } from '../context';
import { createScopedLogger } from '../logging';

export async function upsertGithubUser(
  githubId: number,
  githubHandle: string,
  privyUserId?: string,
  githubOAuthToken?: string,
) {
  const logger = createScopedLogger('upsertGithubUser');

  logger.info(`Attempting to upsert GitHub user ${githubHandle}`);

  return await context.prisma.githubUser.upsert({
    where: { githubId },
    update: {
      githubHandle,
      privyUserId,
      githubOAuthToken,
    },
    create: {
      githubId,
      githubHandle,
      privyUserId,
      githubOAuthToken,
    },
  });
}

export async function removeGithubUsersLogin(id: number) {
  await context.prisma.githubUser.update({
    where: { id },
    data: {
      privyUserId: null,
      githubOAuthToken: null,
    },
  });
}
