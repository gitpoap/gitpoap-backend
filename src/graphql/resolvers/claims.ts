import { Authorized, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Claim } from '@generated/type-graphql';
import { AuthLoggingContext } from '../middleware';
import { POAPEvent } from '../../types/poap';
import { retrievePOAPEventInfo } from '../../external/poap';
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
  async totalClaims(@Ctx() { prisma, logger }: AuthLoggingContext): Promise<number> {
    logger.info('Request for total number of Claims');

    return await prisma.claim.count({
      where: { status: ClaimStatus.CLAIMED },
    });
  }

  @Query(() => Number)
  async lastMonthClaims(@Ctx() { prisma, logger }: AuthLoggingContext): Promise<number> {
    logger.info('Request for the count of Claims made in the last month');

    const result = await prisma.claim.aggregate({
      _count: {
        id: true,
      },
      where: {
        mintedAt: { gt: getLastMonthStartDatetime() },
        status: ClaimStatus.CLAIMED,
      },
    });

    return result._count.id;
  }

  @Authorized()
  @Query(() => [FullClaimData], { nullable: true })
  async userClaims(
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
  ): Promise<FullClaimData[] | null> {
    if (userAccessTokenPayload === null) {
      return [];
    }

    logger.info(`Request for the claims for Privy User ID: ${userAccessTokenPayload.privyUserId}`);

    const possibleMatches: Prisma.ClaimWhereInput[] = [];
    if (userAccessTokenPayload.address !== null) {
      possibleMatches.push({
        // Note that this covers both the ethAddress and the ensName
        issuedAddressId: userAccessTokenPayload.address.id,
      });
    }
    if (userAccessTokenPayload.github !== null) {
      possibleMatches.push({
        githubUser: { githubId: userAccessTokenPayload.github.githubId },
      });
    }
    if (userAccessTokenPayload.email !== null) {
      possibleMatches.push({ email: { id: userAccessTokenPayload.email.id } });
    }

    if (possibleMatches.length === 0) {
      return [];
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
          NOT: { poapApprovalStatus: GitPOAPStatus.UNAPPROVED },
          isEnabled: true,
        },
      },
      include: {
        gitPOAP: {
          select: {
            poapEventId: true,
            poapApprovalStatus: true,
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
        return null;
      }

      if (claim.gitPOAP._count.redeemCodes === 0) {
        if (claim.gitPOAP.poapApprovalStatus === GitPOAPStatus.REDEEM_REQUEST_PENDING) {
          logger.warn(`Claim ${claim.id} is waiting for redeem codes from POAP`);
        } else {
          logger.error(`Claim ${claim.id} has no redeem codes`);
        }
        continue;
      }

      results.push({
        claim: claimData,
        event: eventData,
      });
    }

    return results;
  }
}
