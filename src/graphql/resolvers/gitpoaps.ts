import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Claim, ClaimStatus, GitPOAPStatus, GitPOAP, Profile } from '@generated/type-graphql';
import { getLastMonthStartDatetime } from './util';
import { context, Context } from '../../context';
import { POAPEvent, POAPToken } from '../../types/poap';
import { resolveENS } from '../../lib/ens';
import { retrievePOAPEventInfo, retrievePOAPTokenInfo } from '../../external/poap';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';
import { GitPOAPReturnData, splitUsersPOAPs } from '../../lib/poaps';
import { countContributionsForClaim } from '../../lib/contributions';
import { Prisma } from '@prisma/client';

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

  @Field()
  githubHandle: string;

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
  userGitPOAPData: GitPOAPReturnData[],
): Promise<UserGitPOAPData[]> {
  const results: UserGitPOAPData[] = [];

  if (userGitPOAPData.length === 0) {
    return results;
  }

  const profile = await context.prisma.profile.findFirst({
    where: {
      address: {
        ethAddress: userGitPOAPData[0].claim.mintedAddress?.ethAddress,
      },
    },
  });

  /* Here we assume that all user gitpoaps here belong to the same address */
  if (!profile || !profile.githubHandle) {
    return userGitPOAPData.map(gitPOAPData => ({
      ...gitPOAPData,
      contributionCount: 0,
    }));
  }

  for (const gitPOAPData of userGitPOAPData) {
    results.push({
      ...gitPOAPData,
      contributionCount: await countContributionsForClaim(
        gitPOAPData.claim.user,
        gitPOAPData.claim.gitPOAP.project.repos,
        gitPOAPData.claim.gitPOAP,
      ),
    });
  }

  return results;
}

@Resolver(of => GitPOAP)
export class CustomGitPOAPResolver {
  @Query(returns => Number)
  async totalGitPOAPs(@Ctx() { prisma }: Context): Promise<Number> {
    const logger = createScopedLogger('GQL totalGitPOAPs');

    logger.info('Request for total number of GitPOAPs');

    const endTimer = gqlRequestDurationSeconds.startTimer('totalGitPOAPs');

    const result = await prisma.gitPOAP.count({
      where: {
        isEnabled: true,
        NOT: {
          status: GitPOAPStatus.UNAPPROVED,
        },
      },
    });

    logger.debug('Completed request for total number of GitPOAPs');

    endTimer({ success: 1 });

    return result;
  }

  @Query(returns => Number)
  async lastMonthGitPOAPs(@Ctx() { prisma }: Context): Promise<Number> {
    const logger = createScopedLogger('GQL lastMonthGitPOAPs');

    logger.info('Request for the count of GitPOAPs created last month');

    const endTimer = gqlRequestDurationSeconds.startTimer('lastMonthGitPOAPs');

    const result = await prisma.gitPOAP.aggregate({
      _count: {
        id: true,
      },
      where: {
        isEnabled: true,
        createdAt: { gt: getLastMonthStartDatetime() },
        NOT: {
          status: GitPOAPStatus.UNAPPROVED,
        },
      },
    });

    logger.debug('Completed request for the count of GitPOAPs created last month');

    endTimer({ success: 1 });

    return result._count.id;
  }

  @Query(returns => FullGitPOAPEventData, { nullable: true })
  async gitPOAPEvent(
    @Ctx() { prisma }: Context,
    @Arg('id') id: number,
  ): Promise<FullGitPOAPEventData | null> {
    const logger = createScopedLogger('GQL gitPOAPEvent');

    logger.info(`Request for info about GitPOAP ${id}`);

    const endTimer = gqlRequestDurationSeconds.startTimer('gitPOAPEvent');

    const gitPOAP = await prisma.gitPOAP.findUnique({
      where: { id },
    });
    if (gitPOAP === null) {
      logger.warn(`Failed to find GitPOAP with id: ${id}`);
      endTimer({ success: 0 });
      return null;
    }

    const event = await retrievePOAPEventInfo(gitPOAP.poapEventId);
    if (event === null) {
      logger.error(`Failed to query event ${gitPOAP.poapEventId} data from POAP API`);
      endTimer({ success: 0 });
      return null;
    }

    logger.debug(`Completed request for info about GitPOAP ${id}`);

    endTimer({ success: 1 });

    return { gitPOAP, event };
  }

  @Query(returns => UserPOAPs, { nullable: true })
  async userPOAPs(
    @Ctx() { prisma }: Context,
    @Arg('address') address: string,
    @Arg('sort', { defaultValue: 'date' }) sort: string,
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<UserPOAPs | null> {
    const logger = createScopedLogger('GQL userPOAPs');

    logger.info(
      `Request for POAPs for address ${address} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    const endTimer = gqlRequestDurationSeconds.startTimer('userPOAPs');

    switch (sort) {
      case 'date':
        break;
      case 'alphabetical':
        break;
      default:
        logger.warn(`Unknown value provided for sort: ${sort}`);
        endTimer({ success: 0 });
        return null;
    }
    if ((page === null || perPage === null) && page !== perPage) {
      logger.warn('"page" and "perPage" must be specified together');
      endTimer({ success: 0 });
      return null;
    }

    // Resolve ENS if provided
    const resolvedAddress = await resolveENS(address);
    if (resolvedAddress === null) {
      logger.warn('The address provided is invalid');
      endTimer({ success: 0 });
      return null;
    }

    const splitResult = await splitUsersPOAPs(resolvedAddress);
    if (splitResult === null) {
      logger.error(`Failed to split Profile ${resolvedAddress}'s POAPs`);
      endTimer({ success: 0 });
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

    logger.debug(
      `Completed request for POAPs for address ${address} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    endTimer({ success: 1 });

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

  @Query(returns => RepoGitPOAPs, { nullable: true })
  async repoGitPOAPs(
    @Ctx() { prisma }: Context,
    @Arg('repoId') repoId: number,
    @Arg('sort', { defaultValue: 'date' }) sort: string,
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<RepoGitPOAPs | null> {
    const logger = createScopedLogger('GQL repoGitPOAPs');

    logger.info(
      `Request for POAPs for repoId ${repoId} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    const endTimer = gqlRequestDurationSeconds.startTimer('repoGitPOAPs');

    switch (sort) {
      case 'date':
        break;
      case 'alphabetical':
        break;
      default:
        logger.warn(`Unknown value provided for sort: ${sort}`);
        endTimer({ success: 0 });
        return null;
    }
    if ((page === null || perPage === null) && page !== perPage) {
      logger.warn('"page" and "perPage" must be specified together');
      endTimer({ success: 0 });
      return null;
    }

    const repo = await prisma.repo.findUnique({
      where: {
        id: repoId,
      },
      select: {
        project: {
          select: {
            gitPOAPs: {
              where: {
                isEnabled: true,
                NOT: {
                  status: GitPOAPStatus.UNAPPROVED,
                },
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

    logger.debug(
      `Completed request for POAPs for repoId ${repoId} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    endTimer({ success: 1 });

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

  @Query(returns => [GitPOAPWithClaimsCount], { nullable: true })
  async mostClaimedGitPOAPs(
    @Ctx() { prisma }: Context,
    @Arg('count', { defaultValue: 10 }) count: number,
  ): Promise<GitPOAPWithClaimsCount[] | null> {
    const logger = createScopedLogger('GQL mostClaimedGitPOAPs');

    logger.info(`Request for ${count} most claimed GitPOAPs`);

    const endTimer = gqlRequestDurationSeconds.startTimer('mostClaimedGitPOAPs');

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
        endTimer({ success: 0 });
        return null;
      }

      finalResults.push({ gitPOAP, event, claimsCount });
    }

    logger.debug(`Completed request for ${count} most claimed GitPOAPs`);

    endTimer({ success: 1 });

    return finalResults;
  }

  @Query(returns => UserFeaturedPOAPs, { nullable: true })
  async profileFeaturedPOAPs(
    @Ctx() { prisma }: Context,
    @Arg('address') address: string,
  ): Promise<UserFeaturedPOAPs | null> {
    const logger = createScopedLogger('GQL profileFeaturedPOAPs');

    logger.info(`Request for the featured POAPs for address: ${address}`);

    const endTimer = gqlRequestDurationSeconds.startTimer('profileFeaturedPOAPs');

    // Resolve ENS if provided
    const resolvedAddress = await resolveENS(address);
    if (resolvedAddress === null) {
      logger.warn('The address provided is invalid');
      endTimer({ success: 0 });
      return null;
    }

    const results: UserFeaturedPOAPs = {
      gitPOAPs: [],
      poaps: [],
    };

    const profile = await prisma.profile.findFirst({
      where: {
        address: {
          ethAddress: resolvedAddress.toLowerCase(),
        },
      },
      select: {
        id: true,
      },
    });
    if (profile === null) {
      logger.debug("Completed request early for unknown profile's featured POAPs");
      endTimer({ success: 1 });
      return results;
    }

    const poaps = await prisma.featuredPOAP.findMany({
      where: {
        profileId: profile.id,
      },
    });

    for (const poap of poaps) {
      const poapData = await retrievePOAPTokenInfo(poap.poapTokenId);
      if (poapData === null) {
        logger.error(`Failed to query POAP ${poap.poapTokenId} data from POAP API`);
        endTimer({ success: 0 });
        return null;
      }

      const claim = await prisma.claim.findUnique({
        where: {
          poapTokenId: poap.poapTokenId,
        },
      });

      if (claim !== null) {
        results.gitPOAPs.push({
          claim: claim,
          poap: poapData,
        });
      } else {
        results.poaps.push(poapData);
      }
    }

    logger.debug(`Completed request for the featured POAPs for address: ${address}`);

    endTimer({ success: 1 });

    return results;
  }

  @Query(returns => Holders, { nullable: true })
  async gitPOAPHolders(
    @Ctx() { prisma }: Context,
    @Arg('gitPOAPId') gitPOAPId: number,
    @Arg('sort', { defaultValue: 'claim-date' }) sort: string,
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<Holders | null> {
    const logger = createScopedLogger('GQL gitPOAPHolders');

    logger.info(
      `Request for holders of GitPOAP ${gitPOAPId} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    const endTimer = gqlRequestDurationSeconds.startTimer('gitPOAPHolders');

    if ((page === null || perPage === null) && page !== perPage) {
      logger.warn('"page" and "perPage" must be specified together');
      endTimer({ success: 0 });
      return null;
    }

    type ResultType = Profile & {
      githubHandle: string;
      claimsCount: number;
    };

    const claimStatusSelect = Prisma.sql`
      SELECT COUNT(c2.id)::INTEGER FROM "Claim" AS c2
      INNER JOIN "GitPOAP" AS g ON g.id = c2."gitPOAPId"
      WHERE p."addressId" = c2."mintedAddressId"
        AND c2.status IN (
          ${ClaimStatus.MINTING}::"ClaimStatus",
          ${ClaimStatus.CLAIMED}::"ClaimStatus"
        )
    `;

    let results: ResultType[];
    switch (sort) {
      case 'claim-date':
        if (page !== null) {
          results = await prisma.$queryRaw`
            SELECT p.*, u."githubHandle", (${claimStatusSelect}) AS "claimsCount"
            FROM "Claim" AS c
            INNER JOIN "Profile" AS p ON c."mintedAddressId" = p."addressId"
            INNER JOIN "User" AS u ON u.id = c."userId"
            WHERE c."gitPOAPId" = ${gitPOAPId} AND c.status = ${ClaimStatus.CLAIMED}::"ClaimStatus"
            ORDER BY c."updatedAt" DESC
            LIMIT ${<number>perPage} OFFSET ${(<number>page - 1) * <number>perPage}
          `;
        } else {
          results = await prisma.$queryRaw`
            SELECT p.*, u."githubHandle", (${claimStatusSelect}) AS "claimsCount"
            FROM "Claim" AS c
            JOIN "Profile" AS p ON c."mintedAddressId" = p."addressId"
            JOIN "User" AS u ON u.id = c."userId"
            WHERE c."gitPOAPId" = ${gitPOAPId} AND c.status = ${ClaimStatus.CLAIMED}::"ClaimStatus"
            ORDER BY c."updatedAt" DESC
          `;
        }
        break;
      case 'claim-count':
        if (page !== null) {
          results = await prisma.$queryRaw`
            SELECT p.*, u."githubHandle", (${claimStatusSelect}) AS "claimsCount"
            FROM "Claim" AS c
            JOIN "Profile" AS p ON c."mintedAddressId" = p."addressId"
            JOIN "User" AS u ON u.id = c."userId"
            WHERE c."gitPOAPId" = ${gitPOAPId} AND c.status = ${ClaimStatus.CLAIMED}::"ClaimStatus"
            ORDER BY "claimsCount" DESC
            LIMIT ${<number>perPage} OFFSET ${(<number>page - 1) * <number>perPage}
          `;
        } else {
          results = await prisma.$queryRaw`
            SELECT p.*, u."githubHandle", (${claimStatusSelect}) AS "claimsCount"
            FROM "Claim" AS c
            JOIN "Profile" AS p ON c."mintedAddressId" = p."addressId"
            JOIN "User" AS u ON u.id = c."userId"
            WHERE c."gitPOAPId" = ${gitPOAPId} AND c.status = ${ClaimStatus.CLAIMED}::"ClaimStatus"
            ORDER BY "claimsCount" DESC
          `;
        }
        break;
      default:
        logger.warn(`Unknown value provided for sort: ${sort}`);
        endTimer({ success: 0 });
        return null;
    }

    const totalHolders = await prisma.claim.count({
      where: {
        gitPOAPId: gitPOAPId,
        status: ClaimStatus.CLAIMED,
      },
    });

    const holders = {
      totalHolders: totalHolders,
      holders: results.map(r => {
        const holder: Holder = {
          profileId: r.id,
          address: r.address?.ethAddress ?? '',
          bio: r.bio ?? null,
          profileImageUrl: r.profileImageUrl ?? null,
          twitterHandle: r.twitterHandle ?? null,
          personalSiteUrl: r.personalSiteUrl ?? null,
          githubHandle: r.githubHandle,
          gitPOAPCount: r.claimsCount,
          ensName: r.address?.ensName ?? null,
          ensAvatarImageUrl: r.address?.ensAvatarImageUrl ?? null,
        };

        return holder;
      }),
    };

    logger.debug(
      `Completed request for holders of GitPOAP ${gitPOAPId} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    endTimer({ success: 1 });

    return holders;
  }
}
