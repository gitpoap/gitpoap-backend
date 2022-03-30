import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { ClaimStatus, User } from '@generated/type-graphql';
import { getLastMonthStartDatetime } from './util';
import { Context } from '../../context';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';

@Resolver(of => User)
export class CustomUserResolver {
  @Query(returns => Number)
  async totalContributors(@Ctx() { prisma }: Context): Promise<Number> {
    const logger = createScopedLogger('GQL totalContributors');

    logger.info('Request for total contributors');

    const endRequest = gqlRequestDurationSeconds.startTimer();

    const result = await prisma.user.count();

    logger.debug('Completed request for total contributors');

    endRequest({ request: 'totalContributors', success: 1 });

    return result;
  }

  @Query(returns => Number)
  async lastMonthContributors(@Ctx() { prisma }: Context): Promise<Number> {
    const logger = createScopedLogger('GQL lastMonthContributors');

    logger.info("Request for last month's contributors");

    const endRequest = gqlRequestDurationSeconds.startTimer();

    const result = await prisma.user.aggregate({
      _count: {
        id: true,
      },
      where: {
        createdAt: { gt: getLastMonthStartDatetime() },
      },
    });

    logger.debug("Completed request for last month's contributors");

    endRequest({ request: 'lastMonthContributors', success: 1 });

    return result._count.id;
  }
}
