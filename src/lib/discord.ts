import { context } from '../context';
import { createScopedLogger } from '../logging';

export async function upsertDiscordUser(discordId: string, discordHandle: string) {
  const logger = createScopedLogger('upsertDiscordUser');

  logger.info(`Attempting to upsert Discord user ${discordHandle}`);

  try {
    return await context.prisma.discordUser.upsert({
      where: { discordId },
      update: { discordHandle },
      create: {
        discordId,
        discordHandle,
      },
    });
  } catch (err) {
    logger.warn(`Caught exception while trying to upsert DiscordUser: ${err}`);

    return await context.prisma.discordUser.update({
      where: { discordId },
      data: { discordHandle },
    });
  }
}
