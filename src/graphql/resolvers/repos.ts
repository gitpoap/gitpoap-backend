import { Arg, Ctx, Resolver, Query } from 'type-graphql';
import { Repo } from '@generated/type-graphql';
import { getLastWeekStartDay } from './util';

@Resolver(of => Repo)
export class CustomRepoResolver {
  @Query(returns => Number)
  async totalRepos(@Ctx() { prisma }: Context): Promise<Number> {
    const result = await prisma.repo.count();
    return result;
  }

  @Query(returns => Number)
  async lastWeekRepos(@Ctx() { prisma }: Context): Promise<Number> {
    const result = await prisma.repo.aggregate({
      _count: {
        id: true,
      },
      where: {
        createdAt: { gt: getLastWeekStartDay() },
      },
    });
    return result._count.id;
  }
}
