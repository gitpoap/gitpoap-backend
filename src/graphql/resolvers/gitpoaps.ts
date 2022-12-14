import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Claim, GitPOAP } from '@generated/type-graphql';
import { getLastMonthStartDatetime } from './util';
import { AuthLoggingContext } from '../middleware';
import { POAPEvent, POAPToken } from '../../types/poap';
import { resolveENS } from '../../lib/ens';
import { retrievePOAPEventInfo, retrievePOAPTokenInfo } from '../../external/poap';
import { GitPOAPReturnData, splitUsersPOAPs } from '../../lib/poaps';
import { countContributionsForClaim } from '../../lib/contributions';
import { Address, ClaimStatus, GitPOAPStatus, GitPOAPType, Prisma, Profile } from '@prisma/client';

@ObjectType()
class FullGitPOAPEventData {
  @Field(() => GitPOAP)
  gitPOAP: GitPOAP;

  @Field(() => POAPEvent)
  event: POAPEvent;
}

@ObjectType()
class UserGitPOAPData {
  @Field(() => Claim)
  claim: Claim;

  @Field(() => POAPEvent)
  event: POAPEvent;

  @Field()
  contributionCount: number;
}

@ObjectType()
class UserPOAPs {
  @Field()
  totalGitPOAPs: number;

  @Field()
  totalPOAPs: number;

  @Field(() => [UserGitPOAPData])
  gitPOAPs: UserGitPOAPData[];

  @Field(() => [POAPToken])
  poaps: POAPToken[];
}

@ObjectType()
class RepoGitPOAPs {
  @Field()
  totalGitPOAPs: number;

  @Field(() => [FullGitPOAPEventData])
  gitPOAPs: FullGitPOAPEventData[];
}

@ObjectType()
class GitPOAPWithClaimsCount {
  @Field(() => GitPOAP)
  gitPOAP: GitPOAP;

  @Field(() => POAPEvent)
  event: POAPEvent;

  @Field()
  claimsCount: number;
}

@ObjectType()
class UserFeaturedGitPOAPData {
  @Field(() => Claim)
  claim: Claim;

  @Field(() => POAPToken)
  poap: POAPToken;
}

@ObjectType()
class UserFeaturedPOAPs {
  @Field(() => [UserFeaturedGitPOAPData])
  gitPOAPs: UserFeaturedGitPOAPData[];

  @Field(() => [POAPToken])
  poaps: POAPToken[];
}

@ObjectType()
class Holder {
  @Field()
  profileId: number;

  @Field()
  address: string;

  @Field(() => String, { nullable: true })
  bio: string | null;

  @Field(() => String, { nullable: true })
  profileImageUrl: string | null;

  @Field(() => String, { nullable: true })
  twitterHandle: string | null;

  @Field(() => String, { nullable: true })
  personalSiteUrl: string | null;

  @Field(() => String, { nullable: true })
  ensName: string | null;

  @Field(() => String, { nullable: true })
  ensAvatarImageUrl: string | null;

  @Field(() => String, { nullable: true })
  githubHandle: string | null;

  @Field()
  gitPOAPCount: number;
}

@ObjectType()
class Holders {
  @Field()
  totalHolders: number;

  @Field(() => [Holder])
  holders: Holder[];
}

export async function addPRCountData(
  gitPOAPReturnData: GitPOAPReturnData[],
): Promise<UserGitPOAPData[]> {
  const results: UserGitPOAPData[] = [];

  if (gitPOAPReturnData.length === 0) {
    return results;
  }

  for (const gitPOAPData of gitPOAPReturnData) {
    // Short circuit if:
    // * The GitPOAP is CUSTOM
    // * It has no associated GithubUser
    // In both cases there cannot be any associated contribution counts
    if (
      gitPOAPData.claim.gitPOAP.type === GitPOAPType.CUSTOM ||
      gitPOAPData.claim.githubUser === null
    ) {
      results.push({
        ...gitPOAPData,
        contributionCount: 0,
      });
    } else {
      results.push({
        ...gitPOAPData,
        contributionCount: await countContributionsForClaim(
          gitPOAPData.claim.githubUser,
          gitPOAPData.claim.gitPOAP.project?.repos ?? [],
          gitPOAPData.claim.gitPOAP,
        ),
      });
    }
  }

  return results;
}

@Resolver(() => GitPOAP)
export class CustomGitPOAPResolver {
  @Query(() => Number)
  async totalGitPOAPs(@Ctx() { prisma, logger }: AuthLoggingContext): Promise<number> {
    logger.info('Request for total number of GitPOAPs');

    return await prisma.gitPOAP.count({
      where: {
        isEnabled: true,
        NOT: { poapApprovalStatus: GitPOAPStatus.UNAPPROVED },
      },
    });
  }

  @Query(() => Number)
  async lastMonthGitPOAPs(@Ctx() { prisma, logger }: AuthLoggingContext): Promise<number> {
    logger.info('Request for the count of GitPOAPs created last month');

    const result = await prisma.gitPOAP.aggregate({
      _count: {
        id: true,
      },
      where: {
        isEnabled: true,
        createdAt: { gt: getLastMonthStartDatetime() },
        NOT: {
          poapApprovalStatus: GitPOAPStatus.UNAPPROVED,
        },
      },
    });

    return result._count.id;
  }

  @Query(() => FullGitPOAPEventData, { nullable: true })
  async gitPOAPEvent(
    @Ctx() { prisma, logger }: AuthLoggingContext,
    @Arg('id') id: number,
  ): Promise<FullGitPOAPEventData | null> {
    logger.info(`Request for info about GitPOAP ${id}`);

    const gitPOAP = await prisma.gitPOAP.findUnique({
      where: { id },
    });
    if (gitPOAP === null) {
      logger.warn(`Failed to find GitPOAP with id: ${id}`);
      return null;
    }

    const event = await retrievePOAPEventInfo(gitPOAP.poapEventId);
    if (event === null) {
      logger.error(`Failed to query event ${gitPOAP.poapEventId} data from POAP API`);
      return null;
    }

    return { gitPOAP, event };
  }

  @Query(() => UserPOAPs, { nullable: true })
  async userPOAPs(
    @Ctx() { logger }: AuthLoggingContext,
    @Arg('address') address: string,
    @Arg('sort', { defaultValue: 'date' }) sort: string,
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<UserPOAPs | null> {
    logger.info(
      `Request for POAPs for address ${address} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    switch (sort) {
      case 'date':
        break;
      case 'alphabetical':
        break;
      default:
        logger.warn(`Unknown value provided for sort: ${sort}`);
        return null;
    }
    if ((page === null || perPage === null) && page !== perPage) {
      logger.warn('"page" and "perPage" must be specified together');
      return null;
    }

    // Resolve ENS if provided
    const resolvedAddress = await resolveENS(address);
    if (resolvedAddress === null) {
      logger.warn('The address provided is invalid');
      return null;
    }

    const splitResult = await splitUsersPOAPs(resolvedAddress);
    if (splitResult === null) {
      logger.error(`Failed to split Profile ${resolvedAddress}'s POAPs`);
      return null;
    }
    const { gitPOAPsOnly, poapsOnly } = splitResult;

    if (sort === 'date') {
      // Sort so that most recently claimed comes first
      gitPOAPsOnly.sort((left, right) => {
        const leftDate = left.claim.mintedAt as Date;
        const rightDate = right.claim.mintedAt as Date;
        if (leftDate < rightDate) {
          return 1;
        }
        if (leftDate > rightDate) {
          return -1;
        }
        return 0;
      });
      poapsOnly.sort((left, right) => {
        const leftDate = new Date(left.created);
        const rightDate = new Date(right.created);
        if (leftDate < rightDate) {
          return 1;
        }
        if (leftDate > rightDate) {
          return -1;
        }
        return 0;
      });
    } else {
      // === 'alphabetical'
      gitPOAPsOnly.sort((left, right) => {
        return left.event.name.localeCompare(right.event.name);
      });
      poapsOnly.sort((left, right) => {
        return left.event.name.localeCompare(right.event.name);
      });
    }

    if (page) {
      const index = (page - 1) * <number>perPage;
      return {
        totalGitPOAPs: gitPOAPsOnly.length,
        totalPOAPs: poapsOnly.length,
        gitPOAPs: await addPRCountData(gitPOAPsOnly.slice(index, index + <number>perPage)),
        poaps: poapsOnly.slice(index, index + <number>perPage),
      };
    } else {
      return {
        totalGitPOAPs: gitPOAPsOnly.length,
        totalPOAPs: poapsOnly.length,
        gitPOAPs: await addPRCountData(gitPOAPsOnly),
        poaps: poapsOnly,
      };
    }
  }

  @Query(() => RepoGitPOAPs, { nullable: true })
  async repoGitPOAPs(
    @Ctx() { prisma, logger }: AuthLoggingContext,
    @Arg('repoId') repoId: number,
    @Arg('sort', { defaultValue: 'date' }) sort: string,
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<RepoGitPOAPs | null> {
    logger.info(
      `Request for POAPs for repoId ${repoId} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    switch (sort) {
      case 'date':
        break;
      case 'alphabetical':
        break;
      default:
        logger.warn(`Unknown value provided for sort: ${sort}`);
        return null;
    }
    if ((page === null || perPage === null) && page !== perPage) {
      logger.warn('"page" and "perPage" must be specified together');
      return null;
    }

    const repo = await prisma.repo.findUnique({
      where: { id: repoId },
      select: {
        project: {
          select: {
            gitPOAPs: {
              where: {
                isEnabled: true,
                NOT: { poapApprovalStatus: GitPOAPStatus.UNAPPROVED },
              },
            },
          },
        },
      },
    });
    if (repo === null) {
      logger.warn(`Failed to look up repo with ID: ${repoId}`);
      return null;
    }

    const gitPOAPsWithEvents = [];
    for (const gitPOAP of repo.project.gitPOAPs) {
      if (!gitPOAP.isEnabled) {
        logger.info(`Skipping non-enabled GitPOAP ID: ${gitPOAP.id}`);
        continue;
      }

      const event = await retrievePOAPEventInfo(gitPOAP.poapEventId);
      if (event === null) {
        logger.error(
          `Failed to look up poapEventId: ${gitPOAP.poapEventId} on GitPOAP: ${gitPOAP.id}`,
        );
        continue;
      }
      gitPOAPsWithEvents.push({
        gitPOAP,
        event,
      });
    }

    if (sort === 'date') {
      // Sort so that most recently claimed comes first
      gitPOAPsWithEvents.sort((left, right) => {
        // Note that we create claim placeholders before they are
        // actually initiated by the user so the claim time is
        // the updatedAt time
        const leftDate = new Date(left.gitPOAP.createdAt);
        const rightDate = new Date(right.gitPOAP.createdAt);
        if (leftDate < rightDate) {
          return 1;
        }
        if (leftDate > rightDate) {
          return -1;
        }
        return 0;
      });
    } else {
      // === 'alphabetical'
      gitPOAPsWithEvents.sort((left, right) => {
        return left.event.name.localeCompare(right.event.name);
      });
    }

    if (page) {
      const index = (page - 1) * <number>perPage;
      return {
        totalGitPOAPs: gitPOAPsWithEvents.length,
        gitPOAPs: gitPOAPsWithEvents.slice(index, index + <number>perPage),
      };
    } else {
      return {
        totalGitPOAPs: gitPOAPsWithEvents.length,
        gitPOAPs: gitPOAPsWithEvents,
      };
    }
  }

  @Query(() => [GitPOAPWithClaimsCount], { nullable: true })
  async mostClaimedGitPOAPs(
    @Ctx() { prisma, logger }: AuthLoggingContext,
    @Arg('count', { defaultValue: 10 }) count: number,
  ): Promise<GitPOAPWithClaimsCount[] | null> {
    logger.info(`Request for ${count} most claimed GitPOAPs`);

    type ResultType = GitPOAP & {
      claimsCount: number;
    };

    const results: ResultType[] = await prisma.$queryRaw`
      SELECT g.*, COUNT(c.id)::INTEGER AS "claimsCount"
      FROM "GitPOAP" AS g
      INNER JOIN "Claim" AS c ON c."gitPOAPId" = g.id
        AND c."status" IN (
          ${ClaimStatus.MINTING}::"ClaimStatus",
          ${ClaimStatus.CLAIMED}::"ClaimStatus"
        )
      GROUP BY g.id
      ORDER BY "claimsCount" DESC
      LIMIT ${count}
    `;

    const finalResults = [];

    for (const result of results) {
      const { claimsCount, ...gitPOAP } = result;

      const event = await retrievePOAPEventInfo(gitPOAP.poapEventId);
      if (event === null) {
        logger.error(`Failed to query event ${gitPOAP.poapEventId} data from POAP API`);
        return null;
      }

      finalResults.push({ gitPOAP, event, claimsCount });
    }

    return finalResults;
  }

  @Query(() => UserFeaturedPOAPs, { nullable: true })
  async profileFeaturedPOAPs(
    @Ctx() { prisma, logger }: AuthLoggingContext,
    @Arg('address') address: string,
  ): Promise<UserFeaturedPOAPs | null> {
    logger.info(`Request for the featured POAPs for address: ${address}`);

    // Resolve ENS if provided
    const resolvedAddress = await resolveENS(address);
    if (resolvedAddress === null) {
      logger.warn('The address provided is invalid');
      return null;
    }

    const results: UserFeaturedPOAPs = {
      gitPOAPs: [],
      poaps: [],
    };

    const profile = await prisma.profile.findFirst({
      where: {
        address: { ethAddress: resolvedAddress.toLowerCase() },
      },
      select: { id: true },
    });
    if (profile === null) {
      logger.debug("Completed request early for unknown profile's featured POAPs");
      return results;
    }

    const poaps = await prisma.featuredPOAP.findMany({
      where: { profileId: profile.id },
    });
    for (const poap of poaps) {
      const poapData = await retrievePOAPTokenInfo(poap.poapTokenId);
      if (poapData === null) {
        logger.error(`Failed to query POAP ${poap.poapTokenId} data from POAP API`);
        return null;
      }

      const claim = await prisma.claim.findUnique({
        where: { poapTokenId: poap.poapTokenId },
      });

      if (claim !== null) {
        results.gitPOAPs.push({
          claim,
          poap: poapData,
        });
      } else {
        results.poaps.push(poapData);
      }
    }

    return results;
  }

  @Query(() => Holders, { nullable: true })
  async gitPOAPHolders(
    @Ctx() { prisma, logger }: AuthLoggingContext,
    @Arg('gitPOAPId') gitPOAPId: number,
    @Arg('sort', { defaultValue: 'claim-date' }) sort: string,
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<Holders | null> {
    logger.info(
      `Request for holders of GitPOAP ${gitPOAPId} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    if ((page === null || perPage === null) && page !== perPage) {
      logger.warn('"page" and "perPage" must be specified together');
      return null;
    }

    const statusChoicesSql = Prisma.sql`(${ClaimStatus.MINTING}::"ClaimStatus", ${ClaimStatus.CLAIMED}::"ClaimStatus")`;

    const claimStatusSelect = Prisma.sql`
      SELECT COUNT(c2.id)::INTEGER FROM "Claim" AS c2
      INNER JOIN "GitPOAP" AS g ON g.id = c2."gitPOAPId"
      WHERE p."addressId" = c2."mintedAddressId"
        AND c2.status IN ${statusChoicesSql}
    `;

    let pageChoiceSql = Prisma.empty;
    if (page !== null) {
      pageChoiceSql = Prisma.sql`LIMIT ${<number>perPage} OFFSET ${
        (<number>page - 1) * <number>perPage
      }`;
    }

    let orderBySql;
    switch (sort) {
      case 'claim-date':
        orderBySql = Prisma.sql`ORDER BY c."updatedAt" DESC`;
        break;
      case 'claim-count':
        orderBySql = Prisma.sql`ORDER BY "claimsCount" DESC`;
        break;
      default:
        logger.warn(`Unknown value provided for sort: ${sort}`);
        return null;
    }

    type HolderResultType = Profile &
      Pick<Address, 'ethAddress' | 'ensName' | 'ensAvatarImageUrl'> & {
        githubHandle: string | null;
        claimsCount: number;
      };

    const results = await Promise.all([
      prisma.claim.count({
        where: {
          gitPOAPId,
          status: { in: [ClaimStatus.MINTING, ClaimStatus.CLAIMED] },
        },
      }),
      prisma.$queryRaw<HolderResultType[]>`
        SELECT a.*, p.*, (${claimStatusSelect}) AS "claimsCount",
          COALESCE(u."githubHandle", p."githubHandle") AS "githubHandle"
        FROM "Claim" AS c
        INNER JOIN "Address" AS a ON c."mintedAddressId" = a.id
        INNER JOIN "Profile" AS p ON p."addressId" = a.id
        LEFT JOIN "GithubUser" AS u ON u.id = a."githubUserId"
        WHERE c."gitPOAPId" = ${gitPOAPId} AND c.status IN ${statusChoicesSql}
        ${orderBySql} ${pageChoiceSql}
      `,
    ]);

    return {
      totalHolders: results[0],
      holders: results[1].map(r => ({
        profileId: r.id,
        address: r.ethAddress,
        bio: r.bio ?? null,
        profileImageUrl: r.profileImageUrl ?? null,
        twitterHandle: r.twitterHandle ?? null,
        personalSiteUrl: r.personalSiteUrl ?? null,
        githubHandle: r.githubHandle,
        gitPOAPCount: r.claimsCount,
        ensName: r.ensName,
        ensAvatarImageUrl: r.ensAvatarImageUrl,
      })),
    };
  }
}
