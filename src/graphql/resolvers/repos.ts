import { Arg, Ctx, Resolver, Query } from 'type-graphql';
import { Repo } from '@generated/type-graphql';
import { getLastMonthStartDatetime } from './util';
import { Context } from '../../context';

@Resolver(of => Repo)
export class CustomRepoResolver {
  @Query(returns => Number)
  async totalRepos(@Ctx() { prisma }: Context): Promise<Number> {
    const result = await prisma.repo.count();
    return result;
  }

  @Query(returns => Number)
  async lastMonthRepos(@Ctx() { prisma }: Context): Promise<Number> {
    const result = await prisma.repo.aggregate({
      _count: {
        id: true,
      },
      where: {
        createdAt: { gt: getLastMonthStartDatetime() },
      },
    });
    return result._count.id;
  }

  @Query(returns => [Repo])
  async recentlyAddedProjects(
    @Ctx() { prisma }: Context,
    @Arg('count', { defaultValue: 10 }) count: number,
  ): Promise<Repo[]> {
    return await prisma.repo.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: count,
      include: {
        organization: true,
      },
    });
  }
}
