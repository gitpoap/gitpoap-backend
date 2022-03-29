import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Claim, ClaimStatus } from '@generated/type-graphql';
import { Context } from '../../context';
import { POAPEvent } from '../../types/poap';
import { retrievePOAPEventInfo } from '../../external/poap';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';

@ObjectType()
class FullClaimData {
  @Field(() => Claim)
  claim: Claim;

  @Field(() => POAPEvent)
  event: POAPEvent;
}

@Resolver(of => Claim)
export class CustomClaimResolver {
  @Query(returns => [FullClaimData], { nullable: true })
  async userClaims(
    @Ctx() { prisma }: Context,
    @Arg('githubId') githubId: number,
  ): Promise<FullClaimData[] | null> {
    const logger = createScopedLogger('GQL userClaims');

    logger.info(`Request for the claims for githubId: ${githubId}`);

    const endRequest = gqlRequestDurationSeconds.startTimer();

    const claims = await prisma.claim.findMany({
      where: {
        user: {
          githubId: githubId,
        },
        status: ClaimStatus.UNCLAIMED,
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
        endRequest({ request: 'userClaims', success: 0 });
        return null;
      }

      results.push({
        claim: claimData,
        event: eventData,
      });
    }

    logger.debug(`Completed request for the claims for githubId: ${githubId}`);

    endRequest({ request: 'userClaims', success: 1 });

    return results;
  }
}
