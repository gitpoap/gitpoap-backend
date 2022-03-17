import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { ClaimStatus, User } from '@generated/type-graphql';
import { getLastMonthStartDatetime } from './util';
import { Context } from '../../context';
import { createScopedLogger } from '../../logging';

@ObjectType()
class UserWithClaimsCount {
  @Field(() => User)
  user: User;

  @Field()
  claimsCount: Number;
}

@Resolver(of => User)
export class CustomUserResolver {
  @Query(returns => Number)
  async totalContributors(@Ctx() { prisma }: Context): Promise<Number> {
    const logger = createScopedLogger('GQL totalContributors');

    logger.info('Request for total contributors');

    const result = await prisma.user.count();

    logger.debug('Completed request for total contributors');

    return result;
  }

  @Query(returns => Number)
  async lastMonthContributors(@Ctx() { prisma }: Context): Promise<Number> {
    const logger = createScopedLogger('GQL lastMonthContributors');

    logger.info("Request for last month's contributors");

    const result = await prisma.user.aggregate({
      _count: {
        id: true,
      },
      where: {
        createdAt: { gt: getLastMonthStartDatetime() },
      },
    });

    logger.debug("Completed request for last month's contributors");

    return result._count.id;
  }

  @Query(returns => [UserWithClaimsCount])
  async mostHonoredContributors(
    @Ctx() { prisma }: Context,
    @Arg('count', { defaultValue: 10 }) count: Number,
  ): Promise<UserWithClaimsCount[]> {
    const logger = createScopedLogger('GQL mostHonoredContributors');

    logger.info(`Request for ${count} most honored contributors`);

    type ResultType = User & {
      claimsCount: Number;
    };

    const results: ResultType[] = await prisma.$queryRaw`
      SELECT u.*, COUNT(c.id) AS "claimsCount"
      FROM "User" AS u
      JOIN "Claim" AS c ON c."userId" = u.id
      WHERE c.status = ${ClaimStatus.CLAIMED}
      GROUP BY u.id
      ORDER BY "claimsCount" DESC
      LIMIT ${count}
    `;

    let finalResults = [];

    for (const result of results) {
      const { claimsCount, ...user } = result;

      finalResults.push({ user, claimsCount });
    }

    logger.debug(`Completed request for ${count} most honored contributors`);

    return finalResults;
  }
}
