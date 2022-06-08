import { context } from '../context';
import { User } from '@generated/type-graphql';
import { createScopedLogger } from '../logging';

// Temporarily wrap the upserts in a try-catch while
// we have an issue open in the prisma repo
export async function upsertUser(id: number, handle: string): Promise<User> {
  const logger = createScopedLogger('upsertUser');

  logger.info(`Attempting to upsert GitHub user ${handle}`);

  try {
    return await context.prisma.user.upsert({
      where: {
        githubId: id,
      },
      update: {
        githubHandle: handle,
      },
      create: {
        githubId: id,
        githubHandle: handle,
      },
    });
  } catch (err) {
    logger.warn(`Caught error: ${err}`);

    const user = await context.prisma.user.findUnique({
      where: {
        githubId: id,
      },
    });

    if (user === null) {
      const msg = `Failed to upsert GitHub user ${handle} but the user doesn't exist!`;
      logger.error(msg);
      throw Error(msg);
    }

    return user;
  }
}
