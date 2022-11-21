import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Claim } from '@generated/type-graphql';
import { Context } from '../../context';
import { POAPEvent } from '../../types/poap';
import { retrievePOAPEventInfo } from '../../external/poap';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';
import { getLastMonthStartDatetime } from './util';
import { ClaimStatus, GitPOAPStatus, Prisma } from '@prisma/client';

@ObjectType()
class FullClaimData {
  @Field(() => Claim)
  claim: Claim;

  @Field(() => POAPEvent)
  event: POAPEvent;
}

@Resolver(() => Claim)
export class CustomClaimResolver {
  @Query(() => Number)
  async totalClaims(@Ctx() { prisma }: Context): Promise<number> {
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

  @Query(() => Number)
  async lastMonthClaims(@Ctx() { prisma }: Context): Promise<number> {
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

  @Query(() => [FullClaimData], { nullable: true })
  async userClaims(
    @Ctx() { prisma }: Context,
    @Arg('address') address: string,
  ): Promise<FullClaimData[] | null> {
    const logger = createScopedLogger('GQL userClaims');

    logger.info(`Request for the claims for address: ${address}`);

    const endTimer = gqlRequestDurationSeconds.startTimer('userClaims');

    const addressRecord = await prisma.address.findUnique({
      where: {
        ethAddress: address.toLowerCase(),
      },
      select: {
        id: true,
        ethAddress: true,
        githubUser: true,
        email: true,
      },
    });

    if (addressRecord === null) {
      logger.debug(`Completed request for the claims for address: ${address}`);
      endTimer({ success: 1 });
      return [];
    }

    const possibleMatches: Prisma.Enumerable<Prisma.ClaimWhereInput[]> = [
      // Note that this covers both the ethAddress and the ensName
      { issuedAddressId: addressRecord.id },
    ];

    const githubId = addressRecord.githubUser?.githubId ?? null;
    if (githubId !== null) {
      possibleMatches.push({ githubUser: { githubId } });
    }
    const emailAddress = addressRecord.email?.emailAddress ?? null;
    if (emailAddress !== null) {
      possibleMatches.push({
        email: { emailAddress: emailAddress.toLowerCase() },
      });
    }

    const claims = await prisma.claim.findMany({
      where: {
        AND: [
          { OR: possibleMatches },
          {
            OR: [
              {
                status: {
                  in: [ClaimStatus.UNCLAIMED, ClaimStatus.PENDING, ClaimStatus.MINTING],
                },
              },
              {
                mintedAt: { gt: getLastMonthStartDatetime() },
                status: ClaimStatus.CLAIMED,
              },
            ],
          },
        ],
        gitPOAP: {
          NOT: {
            poapApprovalStatus: GitPOAPStatus.UNAPPROVED,
          },
          isEnabled: true,
        },
      },
      include: {
        gitPOAP: {
          select: {
            poapEventId: true,
            _count: {
              select: { redeemCodes: true },
            },
          },
        },
      },
    });

    const results: FullClaimData[] = [];

    for (const claim of claims) {
      const { gitPOAP, ...claimData } = claim;

      const eventData = await retrievePOAPEventInfo(gitPOAP.poapEventId);

      if (eventData === null) {
        logger.error(`Failed to query event ${gitPOAP.poapEventId} data from POAP API`);
        endTimer({ success: 0 });
        return null;
      }

      if (claim.gitPOAP._count.redeemCodes === 0) {
        logger.error(`Claim ${claim.id} has no redeem codes`);
        continue;
      }

      results.push({
        claim: claimData,
        event: eventData,
      });
    }

    logger.debug(`Completed request for the claims for address: ${address}`);

    endTimer({ success: 1 });

    return results;
  }
}
