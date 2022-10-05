import { context } from '../context';
import { User } from '@generated/type-graphql';
import { createScopedLogger } from '../logging';

export async function upsertUser(
  githubId: number,
  githubHandle: string,
  githubOAuthToken?: string,
): Promise<User> {
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
