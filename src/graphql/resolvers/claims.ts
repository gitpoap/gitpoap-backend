import { Authorized, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Claim } from '@generated/type-graphql';
import { AuthLoggingContext } from '../middleware';
import { POAPEvent } from '../../types/poap';
import { retrievePOAPEventInfo } from '../../external/poap';
import { getLastMonthStartDatetime } from './util';
import { ClaimStatus, GitPOAPStatus, Prisma } from '@prisma/client';
import { AuthRoles } from '../auth';
import { InternalError } from '../errors';

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

  @Authorized(AuthRoles.Address)
  @Query(() => [FullClaimData], { nullable: true })
  async userClaims(
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
  ): Promise<FullClaimData[] | null> {
    if (userAccessTokenPayload === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      throw InternalError;
    }

    logger.info(`Request for the claims for address: ${userAccessTokenPayload.ethAddress}`);

    const addressRecord = await prisma.address.findUnique({
      where: { ethAddress: userAccessTokenPayload.ethAddress },
      select: { githubUser: true },
    });

    const possibleMatches: Prisma.Enumerable<Prisma.ClaimWhereInput[]> = [
      // Note that this covers both the ethAddress and the ensName
      { issuedAddressId: userAccessTokenPayload.addressId },
    ];

    const githubId = addressRecord?.githubUser?.githubId ?? null;
    if (githubId !== null) {
      possibleMatches.push({ githubUser: { githubId } });
    }
    const emailAddress = userAccessTokenPayload.emailAddress ?? null;
    if (emailAddress !== null) {
      possibleMatches.push({ email: { emailAddress } });
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
