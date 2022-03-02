import { Arg, Ctx, Resolver, Query } from 'type-graphql';
import { User } from '@generated/type-graphql';
import { getLastWeekStartDay } from './util';
import { Context } from '../../context';

@Resolver(of => User)
export class CustomUserResolver {
  @Query(returns => Number)
  async totalContributors(@Ctx() { prisma }: Context): Promise<Number> {
    const result = await prisma.user.count();
    return result;
  }

  @Query(returns => Number)
  async lastWeekContributors(@Ctx() { prisma }: Context): Promise<Number> {
    const result = await prisma.user.aggregate({
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
