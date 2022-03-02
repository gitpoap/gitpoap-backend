import { Arg, Ctx, Resolver, Query } from 'type-graphql';
import { GitPOAP } from '@generated/type-graphql';
import { getLastWeekStartDay } from './util';

@Resolver(of => GitPOAP)
export class CustomGitPOAPResolver {
  @Query(returns => Number)
  async totalGitPOAPs(@Ctx() { prisma }: Context): Promise<Number> {
    const result = await prisma.gitPOAP.count();
    return result;
  }

  @Query(returns => Number)
  async lastWeekGitPOAPs(@Ctx() { prisma }: Context): Promise<Number> {
    const result = await prisma.gitPOAP.aggregate({
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
