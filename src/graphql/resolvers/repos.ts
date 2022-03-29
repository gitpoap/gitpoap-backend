import { Arg, Ctx, Resolver, Query } from 'type-graphql';
import { Repo } from '@generated/type-graphql';
import { getLastMonthStartDatetime } from './util';
import { Context } from '../../context';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';

@Resolver(of => Repo)
export class CustomRepoResolver {
  @Query(returns => Number)
  async totalRepos(@Ctx() { prisma }: Context): Promise<Number> {
    const logger = createScopedLogger('GQL totalRepos');

    logger.info('Request for total number of repos');

    const endRequest = gqlRequestDurationSeconds.startTimer();

    const result = await prisma.repo.count();

    logger.debug('Completed request for total number of repos');

    endRequest({ request: 'totalRepos', success: 1 });

    return result;
  }

  @Query(returns => Number)
  async lastMonthRepos(@Ctx() { prisma }: Context): Promise<Number> {
    const logger = createScopedLogger('GQL lastMonthRepos');

    logger.info("Request for count of last month's new repos");

    const endRequest = gqlRequestDurationSeconds.startTimer();

    const result = await prisma.repo.aggregate({
      _count: {
        id: true,
      },
      where: {
        createdAt: { gt: getLastMonthStartDatetime() },
      },
    });

    logger.debug("Completed request for count of last month's new repos");

    endRequest({ request: 'lastMonthRepos', success: 1 });

    return result._count.id;
  }

  @Query(returns => [Repo])
  async recentlyAddedProjects(
    @Ctx() { prisma }: Context,
    @Arg('count', { defaultValue: 10 }) count: number,
  ): Promise<Repo[]> {
    const logger = createScopedLogger('GQL recentlyAddedProjects');

    logger.info(`Request for the ${count} most recently added projects`);

    const endRequest = gqlRequestDurationSeconds.startTimer();

    const results = await prisma.repo.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: count,
      include: {
        organization: true,
      },
    });

    logger.debug(`Completed request for the ${count} most recently added projects`);

    endRequest({ request: 'recentlyAddedProjects', success: 1 });

    return results;
  }
}
