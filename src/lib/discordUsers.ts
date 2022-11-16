import { context } from '../context';
import { createScopedLogger } from '../logging';

export async function upsertDiscordUser(
  discordId: string,
  discordHandle: string,
  discordOAuthToken?: string,
) {
  const logger = createScopedLogger('upsertDiscordUser');

  logger.info(`Attempting to upsert Discord user ${discordHandle}`);

  return await context.prisma.discordUser.upsert({
    where: {
      discordId,
    },
    update: {
      discordHandle,
      discordOAuthToken,
    },
    create: {
      discordId,
      discordHandle,
      discordOAuthToken,
    },
  });
}

export async function removeDiscordUsersDiscordOAuthToken(discordUserId: number) {
  await context.prisma.discordUser.update({
    where: {
      id: discordUserId,
    },
    data: {
      discordOAuthToken: null,
    },
  });
}
