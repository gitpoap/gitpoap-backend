import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { ClaimStatus, User } from '@generated/type-graphql';
import { getLastWeekStartDatetime } from './util';
import { Context } from '../../context';

@ObjectType()
class UserWithClaimsCount {
  @Field(() => User)
  user: User;

  @Field()
  claims_count: Number;
}

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
        createdAt: { gt: getLastWeekStartDatetime() },
      },
    });
    return result._count.id;
  }

  @Query(returns => [UserWithClaimsCount])
  async lastWeekMostHonoredContributors(
    @Ctx() { prisma }: Context,
    @Arg('count', { defaultValue: 10 }) count: Number,
  ): Promise<UserWithClaimsCount[]> {
    const lastWeek = getLastWeekStartDatetime();

    type ResultType = User & {
      claims_count: Number;
    };

    const results: ResultType[] = await prisma.$queryRaw`
      SELECT u.*, COUNT(c.id) AS claims_count
      FROM "User" AS u
      JOIN "Claim" AS c ON c."userId" = u.id
      WHERE c."updatedAt" > ${lastWeek} AND c.status = ${ClaimStatus.CLAIMED}
      GROUP BY u.id
      ORDER BY claims_count DESC
      LIMIT ${count}
    `;

    let finalResults = [];

    for (let result of results) {
      const { claims_count, ...user } = result;

      finalResults.push({ user, claims_count });
    }

    return finalResults;
  }
}
