import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Claim, ClaimStatus, GitPOAP } from '@generated/type-graphql';
import { getLastWeekStartDatetime } from './util';
import { Context } from '../../context';
import { POAPEvent, POAPToken } from '../types/poap';
import { resolveENS } from '../../util';
import { retrievePOAPEventInfo, retrieveUsersPOAPs, retrievePOAPInfo } from '../../poap';

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
  totalGitPOAPs: Number;

  @Field()
  totalPOAPs: Number;

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
  claimsCount: Number;
}

@ObjectType()
class UserFeaturedPOAPs {
  @Field(() => [FullGitPOAPData])
  gitPOAPs: FullGitPOAPData[];

  @Field(() => [POAPToken])
  poaps: POAPToken[];
}

@Resolver(of => GitPOAP)
export class CustomGitPOAPResolver {
  @Query(returns => Number)
  async totalGitPOAPs(@Ctx() { prisma }: Context): Promise<Number> {
    const result = await prisma.gitPOAP.count();
    return result;
  }

  @Query(returns => Number)
  async lastWeekGitPOAPs(@Ctx() { prisma }: Context): Promise<Number> {
    const result = await prisma.gitPOAP.aggregate({
      _count: {
        id: true,
      },
      where: {
        createdAt: { gt: getLastWeekStartDatetime() },
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
    switch (sort) {
      case 'date':
        break;
      case 'alphabetical':
        break;
      default:
        console.log(`Unknown value provided for sort: ${sort}`);
        return null;
    }
    if ((page === null || perPage === null) && page !== perPage) {
      console.log('"page" and "perPage" must be specified together');
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
        console.log(`Found a null poapTokenId, but the Claim has status CLAIMED. id: ${claim.id}`);
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
    @Arg('count', { defaultValue: 10 }) count: Number,
  ): Promise<GitPOAPWithClaimsCount[] | null> {
    type ResultType = GitPOAP & {
      claimsCount: Number;
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
      include: {
        claim: true,
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

      if (poap.claim) {
        results.gitPOAPs.push({
          claim: poap.claim,
          poap: poapData,
        });
      } else {
        results.poaps.push(poapData);
      }
    }

    return results;
  }
}
