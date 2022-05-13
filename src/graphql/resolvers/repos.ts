import { Arg, Ctx, Resolver, Query } from 'type-graphql';
import { Repo, RepoOrderByWithRelationInput } from '@generated/type-graphql';
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

    const endTimer = gqlRequestDurationSeconds.startTimer('totalRepos');

    const result = await prisma.repo.count();

    logger.debug('Completed request for total number of repos');

    endTimer({ success: 1 });

    return result;
  }

  @Query(returns => Number)
  async lastMonthRepos(@Ctx() { prisma }: Context): Promise<Number> {
    const logger = createScopedLogger('GQL lastMonthRepos');

    logger.info("Request for count of last month's new repos");

    const endTimer = gqlRequestDurationSeconds.startTimer('lastMonthRepos');

    const result = await prisma.repo.aggregate({
      _count: {
        id: true,
      },
      where: {
        createdAt: { gt: getLastMonthStartDatetime() },
      },
    });

    logger.debug("Completed request for count of last month's new repos");

    endTimer({ success: 1 });

    return result._count.id;
  }

  @Query(returns => [Repo])
  async recentlyAddedProjects(
    @Ctx() { prisma }: Context,
    @Arg('count', { defaultValue: 10 }) count: number,
  ): Promise<Repo[]> {
    const logger = createScopedLogger('GQL recentlyAddedProjects');

    logger.info(`Request for the ${count} most recently added projects`);

    const endTimer = gqlRequestDurationSeconds.startTimer('recentlyAddedProjects');

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

    endTimer({ success: 1 });

    return results;
  }

  @Query(returns => [Repo], { nullable: true })
  async allRepos(
    @Ctx() { prisma }: Context,
    @Arg('sort', { defaultValue: 'alphabetical' }) sort: string,
    @Arg('order', { defaultValue: 'desc' }) order?: 'asc' | 'desc',
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<Repo[] | null> {
    const logger = createScopedLogger('GQL allRepos');

    logger.info(
      `Request for all repos using sort ${sort}, order ${order}, with ${perPage} results per page and page ${page}`,
    );

    const endTimer = gqlRequestDurationSeconds.startTimer('allRepos');

    let orderBy: RepoOrderByWithRelationInput;
    switch (sort) {
      case 'alphabetical':
        orderBy = {
          name: order,
        };
        break;
      case 'date':
        orderBy = {
          updatedAt: order,
        };
        break;
      case 'gitpoap-count':
        orderBy = {
          gitPOAPs: {
            _count: order,
          },
        };
        break;
      case 'organization':
        orderBy = {
          organization: {
            name: order,
          },
        };
        break;
      default:
        logger.warn(`Unknown value provided for sort: ${sort}`);
        endTimer({ success: 0 });
        return null;
    }

    if ((page === null || perPage === null) && page !== perPage) {
      logger.warn('"page" and "perPage" must be specified together');
      endTimer({ success: 0 });
      return null;
    }

    const results = await prisma.repo.findMany({
      orderBy,
      skip: page ? (page - 1) * <number>perPage : undefined,
      take: perPage ?? undefined,
    });

    logger.info(
      `Request for all repos using sort ${sort}, order ${order}, with ${perPage} results per page and page ${page}`,
    );

    endTimer({ success: 1 });

    return results;
  }
}
