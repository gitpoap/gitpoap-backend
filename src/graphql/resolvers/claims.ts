import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Claim, ClaimStatus } from '@generated/type-graphql';
import { Context } from '../../context';
import { POAPEvent } from '../../types/poap';
import { retrievePOAPEventInfo } from '../../external/poap';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';
import { getLastMonthStartDatetime } from './util';

@ObjectType()
class FullClaimData {
  @Field(() => Claim)
  claim: Claim;

  @Field(() => POAPEvent)
  event: POAPEvent;
}

@Resolver(of => Claim)
export class CustomClaimResolver {
  @Query(returns => Number)
  async totalClaims(@Ctx() { prisma }: Context): Promise<Number> {
    const logger = createScopedLogger('GQL totalClaims');

    logger.info('Request for total number of Claims');

    const endTimer = gqlRequestDurationSeconds.startTimer('totalClaims');

    const result = await prisma.claim.count({
      where: {
        status: ClaimStatus.CLAIMED,
      },
    });

    logger.debug('Completed request for total number of Claims');

    endTimer({ success: 1 });

    return result;
  }

  @Query(returns => Number)
  async lastMonthClaims(@Ctx() { prisma }: Context): Promise<Number> {
    const logger = createScopedLogger('GQL lastMonthClaims');

    logger.info('Request for the count of Claims made in the last month');

    const endTimer = gqlRequestDurationSeconds.startTimer('lastMonthClaims');

    const result = await prisma.claim.aggregate({
      _count: {
        id: true,
      },
      where: {
        mintedAt: { gt: getLastMonthStartDatetime() },
        status: ClaimStatus.CLAIMED,
      },
    });

    logger.debug('Completed request for the count of Claims made in the last month');

    endTimer({ success: 1 });

    return result._count.id;
  }

  @Query(returns => [FullClaimData], { nullable: true })
  async userClaims(
    @Ctx() { prisma }: Context,
    @Arg('githubId') githubId: number,
  ): Promise<FullClaimData[] | null> {
    const logger = createScopedLogger('GQL userClaims');

    logger.info(`Request for the claims for githubId: ${githubId}`);

    const endTimer = gqlRequestDurationSeconds.startTimer('userClaims');

    const claims = await prisma.claim.findMany({
      where: {
        user: {
          githubId: githubId,
        },
        OR: [
          {
            status: ClaimStatus.UNCLAIMED,
          },
          {
            mintedAt: { gt: getLastMonthStartDatetime() },
            status: ClaimStatus.CLAIMED,
          },
        ],
        gitPOAP: {
          isEnabled: true,
        },
      },
      include: {
        gitPOAP: {
          select: {
            poapEventId: true,
          },
        },
      },
    });

    let results: FullClaimData[] = [];

    for (const claim of claims) {
      const { gitPOAP, ...claimData } = claim;

      const eventData = await retrievePOAPEventInfo(gitPOAP.poapEventId);

      if (eventData === null) {
        logger.error(`Failed to query event ${gitPOAP.poapEventId} data from POAP API`);
        endTimer({ success: 0 });
        return null;
      }

      results.push({
        claim: claimData,
        event: eventData,
      });
    }

    logger.debug(`Completed request for the claims for githubId: ${githubId}`);

    endTimer({ success: 1 });

    return results;
  }
}
