import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Claim, ClaimStatus, GitPOAP, Profile } from '@generated/type-graphql';
import { getLastMonthStartDatetime } from './util';
import { Context } from '../../context';
import { POAPEvent, POAPToken } from '../../types/poap';
import { resolveENS } from '../../util';
import { retrievePOAPEventInfo, retrieveUsersPOAPs, retrievePOAPInfo } from '../../external/poap';
import { createScopedLogger } from '../../logging';

@ObjectType()
class FullGitPOAPData {
  @Field(() => Claim)
  claim: Claim;

  @Field(() => POAPToken)
  poap: POAPToken;
}

@ObjectType()
class UserPOAPs {
  @Field()
  totalGitPOAPs: number;

  @Field()
  totalPOAPs: number;

  @Field(() => [FullGitPOAPData])
  gitPOAPs: FullGitPOAPData[];

  @Field(() => [POAPToken])
  poaps: POAPToken[];
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
class UserFeaturedPOAPs {
  @Field(() => [FullGitPOAPData])
  gitPOAPs: FullGitPOAPData[];

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

@Resolver(of => GitPOAP)
export class CustomGitPOAPResolver {
  @Query(returns => Number)
  async totalGitPOAPs(@Ctx() { prisma }: Context): Promise<Number> {
    const result = await prisma.gitPOAP.count();
    return result;
  }

  @Query(returns => Number)
  async lastMonthGitPOAPs(@Ctx() { prisma }: Context): Promise<Number> {
    const result = await prisma.gitPOAP.aggregate({
      _count: {
        id: true,
      },
      where: {
        createdAt: { gt: getLastMonthStartDatetime() },
      },
    });
    return result._count.id;
  }

  @Query(returns => UserPOAPs, { nullable: true })
  async userPOAPs(
    @Ctx() { prisma, provider }: Context,
    @Arg('address') address: string,
    @Arg('sort', { defaultValue: 'date' }) sort: string,
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<UserPOAPs | null> {
    const logger = createScopedLogger('GQL userPOAPs');

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
    const resolvedAddress = await resolveENS(provider, address);
    if (resolvedAddress === null) {
      return null;
    }

    const poaps = await retrieveUsersPOAPs(resolvedAddress);
    if (poaps === null) {
      return null;
    }

    const claims = await prisma.claim.findMany({
      where: {
        address: resolvedAddress.toLowerCase(),
        status: ClaimStatus.CLAIMED,
      },
    });

    let foundPOAPIds: Record<string, Claim> = {};
    for (const claim of claims) {
      if (claim.poapTokenId === null) {
        logger.warn(`Found a null poapTokenId, but the Claim ID ${claim.id} has status CLAIMED`);
        continue;
      }
      foundPOAPIds[claim.poapTokenId] = claim;
    }

    let gitPOAPsOnly = [];
    let poapsOnly = [];
    for (const poap of poaps) {
      if (foundPOAPIds.hasOwnProperty(poap.tokenId)) {
        gitPOAPsOnly.push({
          claim: foundPOAPIds[poap.tokenId],
          poap: poap,
        });
      } else {
        poapsOnly.push(poap);
      }
    }

    if (sort === 'date') {
      // Sort so that most recently claimed comes first
      gitPOAPsOnly.sort((left, right) => {
        // Note that we create claim placeholders before they are
        // actually initiated by the user so the claim time is
        // the updatedAt time
        const leftDate = new Date(left.claim.updatedAt);
        const rightDate = new Date(right.claim.updatedAt);
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
        return left.poap.event.name.localeCompare(right.poap.event.name);
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
        gitPOAPs: gitPOAPsOnly.slice(index, index + <number>perPage),
        poaps: poapsOnly.slice(index, index + <number>perPage),
      };
    } else {
      return {
        totalGitPOAPs: gitPOAPsOnly.length,
        totalPOAPs: poapsOnly.length,
        gitPOAPs: gitPOAPsOnly,
        poaps: poapsOnly,
      };
    }
  }

  @Query(returns => [GitPOAPWithClaimsCount], { nullable: true })
  async mostClaimedGitPOAPs(
    @Ctx() { prisma }: Context,
    @Arg('count', { defaultValue: 10 }) count: number,
  ): Promise<GitPOAPWithClaimsCount[] | null> {
    type ResultType = GitPOAP & {
      claimsCount: number;
    };

    const results: ResultType[] = await prisma.$queryRaw`
      SELECT g.*, COUNT(c.id) AS "claimsCount"
      FROM "GitPOAP" AS g
      JOIN "Claim" AS c ON c."gitPOAPId" = g.id
      GROUP BY g.id
      ORDER BY "claimsCount" DESC
      LIMIT ${count}
    `;

    let finalResults = [];

    for (const result of results) {
      const { claimsCount, ...gitPOAP } = result;

      const event = await retrievePOAPEventInfo(gitPOAP.poapEventId);

      if (event === null) {
        return null;
      }

      finalResults.push({ gitPOAP, event, claimsCount });
    }

    return finalResults;
  }

  @Query(returns => UserFeaturedPOAPs, { nullable: true })
  async profileFeaturedPOAPs(
    @Ctx() { prisma, provider }: Context,
    @Arg('address') address: string,
  ): Promise<UserFeaturedPOAPs | null> {
    // Resolve ENS if provided
    const resolvedAddress = await resolveENS(provider, address);
    if (resolvedAddress === null) {
      return null;
    }

    const poaps = await prisma.featuredPOAP.findMany({
      where: {
        profile: {
          address: resolvedAddress.toLowerCase(),
        },
      },
    });

    let results: UserFeaturedPOAPs = {
      gitPOAPs: [],
      poaps: [],
    };

    for (const poap of poaps) {
      const poapData = await retrievePOAPInfo(poap.poapTokenId);
      if (poapData === null) {
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

    return results;
  }

  @Query(returns => Holders, { nullable: true })
  async gitPOAPHolders(
    @Ctx() { prisma, provider }: Context,
    @Arg('gitPOAPId') gitPOAPId: number,
    @Arg('sort', { defaultValue: 'claim-date' }) sort: string,
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<Holders | null> {
    const logger = createScopedLogger('GQL gitPOAPHolders');

    if ((page === null || perPage === null) && page !== perPage) {
      logger.warn('"page" and "perPage" must be specified together');
      return null;
    }

    type ResultType = Profile & {
      githubHandle: string;
      claimsCount: number;
    };

    let results: ResultType[];
    switch (sort) {
      case 'claim-date':
        if (page !== null) {
          results = await prisma.$queryRaw`
            SELECT p.*, u."githubHandle",
                   (SELECT COUNT(c2.id) FROM "Claim" AS c2 WHERE p.address = c2.address) AS "claimsCount"
            FROM "Claim" AS c
            JOIN "Profile" AS p ON c.address = p.address
            JOIN "User" AS u ON u.id = c."userId"
            WHERE c."gitPOAPId" = ${gitPOAPId} AND c.status = ${ClaimStatus.CLAIMED}
            ORDER BY c."updatedAt" DESC
            LIMIT ${<number>perPage} OFFSET ${(<number>page - 1) * <number>perPage}
          `;
        } else {
          results = await prisma.$queryRaw`
            SELECT p.*, u."githubHandle",
                   (SELECT COUNT(c2.id) FROM "Claim" AS c2 WHERE p.address = c2.address) AS "claimsCount"
            FROM "Claim" AS c
            JOIN "Profile" AS p ON c.address = p.address
            JOIN "User" AS u ON u.id = c."userId"
            WHERE c."gitPOAPId" = ${gitPOAPId} AND c.status = ${ClaimStatus.CLAIMED}
            ORDER BY c."updatedAt" DESC
          `;
        }
        break;
      case 'claim-count':
        if (page !== null) {
          results = await prisma.$queryRaw`
            SELECT p.*, u."githubHandle",
                   (SELECT COUNT(c2.id) FROM "Claim" AS c2 WHERE p.address = c2.address) AS "claimsCount"
            FROM "Claim" AS c
            JOIN "Profile" AS p ON c.address = p.address
            JOIN "User" AS u ON u.id = c."userId"
            WHERE c."gitPOAPId" = ${gitPOAPId} AND c.status = ${ClaimStatus.CLAIMED}
            ORDER BY "claimsCount" DESC
            LIMIT ${<number>perPage} OFFSET ${(<number>page - 1) * <number>perPage}
          `;
        } else {
          results = await prisma.$queryRaw`
            SELECT p.*, u."githubHandle",
                   (SELECT COUNT(c2.id) FROM "Claim" AS c2 WHERE p.address = c2.address) AS "claimsCount"
            FROM "Claim" AS c
            JOIN "Profile" AS p ON c.address = p.address
            JOIN "User" AS u ON u.id = c."userId"
            WHERE c."gitPOAPId" = ${gitPOAPId} AND c.status = ${ClaimStatus.CLAIMED}
            ORDER BY "claimsCount" DESC
          `;
        }
        break;
      default:
        logger.warn(`Unknown value provided for sort: ${sort}`);
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
        return <Holder>{
          profileId: r.id,
          address: r.address,
          bio: r.bio,
          profileImageUrl: r.profileImageUrl,
          twitterHandle: r.twitterHandle,
          personalSiteUrl: r.personalSiteUrl,
          githubHandle: r.githubHandle,
          gitPOAPCount: r.claimsCount,
        };
      }),
    };

    return holders;
  }
}
