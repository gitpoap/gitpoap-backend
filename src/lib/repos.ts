import { createScopedLogger } from '../logging';
import { context } from '../context';
import { RepoData } from './claims';

export async function getRepoByName(owner: string, repo: string): Promise<RepoData | null> {
  const logger = createScopedLogger('getRepoByName');

  const result = await context.prisma.repo.findMany({
    where: {
      name: repo,
      organization: {
        name: owner,
      },
    },
    select: {
      id: true,
      gitPOAPs: {
        where: {
          ongoing: true,
        },
        select: {
          id: true,
          year: true,
          threshold: true,
        },
      },
    },
  });

  if (result.length === 0) {
    logger.error(`Couldn't find any repos in the DB named "${owner}/${repo}"`);
    return null;
  } else if (result.length > 1) {
    logger.error(`Found multiple repos in DB named "${owner}/${repo}"`);
    return null;
  }

  return result[0];
}
