import { context } from '../context';
import { createScopedLogger } from '../logging';

export async function upsertGithubUser(githubId: number, githubHandle: string) {
  const logger = createScopedLogger('upsertGithubUser');

  logger.info(`Attempting to upsert GitHub user ${githubHandle}`);

  return await context.prisma.githubUser.upsert({
    where: { githubId },
    update: { githubHandle },
    create: {
      githubId,
      githubHandle,
    },
  });
}
