import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Repo as RepoValue } from '@generated/type-graphql';
import { getLastMonthStartDatetime, getXDaysAgoStartDatetime } from './util';
import { AuthLoggingContext } from '../middleware';
import { getGithubRepositoryStarCount } from '../../external/github';
import { ClaimStatus, Prisma } from '@prisma/client';

@ObjectType()
export class RepoReturnData extends RepoValue {
  @Field()
  contributorCount: number;
  @Field()
  gitPOAPCount: number;
  @Field()
  mintedGitPOAPCount: number;
}

@Resolver(() => RepoValue)
export class CustomRepoResolver {
  @Query(() => RepoReturnData, { nullable: true })
  async repoData(
    @Ctx() { prisma, logger }: AuthLoggingContext,
    @Arg('repoId', { defaultValue: null }) repoId?: number,
    @Arg('orgName', { defaultValue: null }) orgName?: string,
    @Arg('repoName', { defaultValue: null }) repoName?: string,
  ): Promise<RepoReturnData | null> {
    logger.info(`Request data for repo: ${repoId}`);

    let results;
    if (repoId) {
      results = await prisma.$queryRaw<RepoReturnData[]>`
        SELECT r.*,
          COUNT(DISTINCT c."githubUserId")::INTEGER AS "contributorCount",
          COUNT(DISTINCT g.id)::INTEGER AS "gitPOAPCount",
          COUNT(c.id)::INTEGER AS "mintedGitPOAPCount"
        FROM "Repo" as r
        INNER JOIN "Project" AS p ON r."projectId" = p.id
        INNER JOIN "GitPOAP" AS g ON g."projectId" = p.id AND g."isEnabled" IS TRUE
        LEFT JOIN
          (
            SELECT * FROM "Claim"
            WHERE status = ${ClaimStatus.CLAIMED}::"ClaimStatus"
          ) AS c ON c."gitPOAPId" = g.id
        WHERE r.id = ${repoId}
        GROUP BY r.id
      `;

      if (results.length === 0) {
        logger.warn(`Failed to find repo with id: ${repoId}`);
        return null;
      }
    } else if (orgName && repoName) {
      results = await prisma.$queryRaw<RepoReturnData[]>`
        SELECT r.*,
          COUNT(DISTINCT c."githubUserId")::INTEGER AS "contributorCount",
          COUNT(DISTINCT g.id)::INTEGER AS "gitPOAPCount",
          COUNT(c.id)::INTEGER AS "mintedGitPOAPCount"
        FROM "Repo" as r
        INNER JOIN "GithubOrganization" AS o ON o.id = r."organizationId"
          AND o.name = ${orgName}
        INNER JOIN "Project" AS p ON r."projectId" = p.id
        INNER JOIN "GitPOAP" AS g ON g."projectId" = p.id AND g."isEnabled" IS TRUE
        LEFT JOIN
          (
            SELECT * FROM "Claim"
            WHERE status = ${ClaimStatus.CLAIMED}::"ClaimStatus"
          ) AS c ON c."gitPOAPId" = g.id
        WHERE r.name = ${repoName}
        GROUP BY r.id
      `;

      if (results.length === 0) {
        logger.warn(`Failed to find repo with orgName: ${orgName} and repoName: ${repoName}`);
        return null;
      }
    } else if (!orgName !== !repoName) {
      logger.warn('"orgName" and "repoName" must be specified together');
      return null;
    } else {
      logger.warn('Either a "repoId" or both "orgName" and "repoName" must be provided');
      return null;
    }

    return results[0];
  }

  @Query(() => Number)
  async repoStarCount(
    @Ctx() { prisma, logger }: AuthLoggingContext,
    @Arg('repoId') repoId: number,
  ): Promise<number | null> {
    logger.info(`Request for star count of repo id: ${repoId}`);

    const repo = await prisma.repo.findUnique({
      where: { id: repoId },
      select: { githubRepoId: true },
    });

    if (repo === null) {
      logger.warn(`Failed to find repo with id: ${repoId}`);
      return null;
    }

    // This returns 0 if there's an error or repo doesn't exist
    return await getGithubRepositoryStarCount(repo.githubRepoId);
  }

  @Query(() => Number)
  async totalRepos(@Ctx() { prisma, logger }: AuthLoggingContext): Promise<number> {
    logger.info('Request for total number of repos');

    return await prisma.repo.count();
  }

  @Query(() => Number)
  async lastMonthRepos(@Ctx() { prisma, logger }: AuthLoggingContext): Promise<number> {
    logger.info("Request for count of last month's new repos");

    const result = await prisma.repo.aggregate({
      _count: { id: true },
      where: {
        createdAt: { gt: getLastMonthStartDatetime() },
      },
    });

    return result._count.id;
  }

  @Query(() => [RepoValue])
  async recentlyAddedRepos(
    @Ctx() { prisma, logger }: AuthLoggingContext,
    @Arg('count', { defaultValue: 10 }) count: number,
  ): Promise<RepoValue[]> {
    logger.info(`Request for the ${count} most recently added repos`);

    return await prisma.repo.findMany({
      orderBy: { createdAt: 'desc' },
      take: count,
      include: { organization: true },
    });
  }

  @Query(() => [RepoReturnData], { nullable: true })
  async allRepos(
    @Ctx() { prisma, logger }: AuthLoggingContext,
    @Arg('sort', { defaultValue: 'alphabetical' }) sort: string,
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<RepoReturnData[] | null> {
    logger.info(
      `Request for all repos using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    let orderBy: Prisma.Sql | undefined = undefined;
    switch (sort) {
      case 'alphabetical':
        orderBy = Prisma.sql`ORDER BY r.name ASC`;
        break;
      case 'date':
        orderBy = Prisma.sql`ORDER BY r."createdAt" DESC`;
        break;
      case 'gitpoap-count':
        orderBy = Prisma.sql`ORDER BY "mintedGitPOAPCount" DESC`;
        break;
      case 'organization':
        orderBy = Prisma.sql`ORDER BY o.name ASC`;
        break;
      default:
        logger.warn(`Unknown value provided for sort: ${sort}`);
        return null;
    }

    if ((page === null || perPage === null) && page !== perPage) {
      logger.warn('"page" and "perPage" must be specified together');
      return null;
    }

    const skip = page ? Prisma.sql`OFFSET ${(page - 1) * <number>perPage}` : Prisma.empty;
    const take = perPage ? Prisma.sql`LIMIT ${perPage}` : Prisma.empty;
    return await prisma.$queryRaw<RepoReturnData[]>`
      SELECT r.* FROM "Repo" AS r,
        COUNT(DISTINCT c."githubUserId")::INTEGER AS "contributorCount",
        COUNT(DISTINCT g.id)::INTEGER AS "gitPOAPCount",
        COUNT(c.id)::INTEGER AS "mintedGitPOAPCount"
      INNER JOIN "GithubOrganization" as o ON o.id = g."organizationId"
      INNER JOIN "Project" AS p ON p.id = r."projectId"
      INNER JOIN "GitPOAP" AS g ON g."projectId" = p.id
      LEFT JOIN "Claim" AS c ON c."gitPOAPId" = g.id
        AND c.status = ${ClaimStatus.CLAIMED}::"ClaimStatus"
      GROUP BY r.id
      ${orderBy}
      ${skip} ${take}
    `;
  }

  @Query(() => [RepoReturnData], { nullable: true })
  async trendingRepos(
    @Ctx() { prisma, logger }: AuthLoggingContext,
    @Arg('count', { defaultValue: 10 }) count: number,
    @Arg('numDays', { defaultValue: 3 }) numDays: number,
  ): Promise<RepoReturnData[] | null> {
    logger.info(`Request for trending repos form the last ${numDays} days`);

    // We will use this map so that we can order the repos by mintedGitPOAPCount
    // and then limit the results we need to query additional data for as we can't
    // directly query mintedGitPOAPCount from the DB, since the fields may be linked
    // by either claim->pullRequestEarned->repoId or claim->mentionEarned->repoId
    type RepoIdToClaimCountsMapValue = {
      repoId: number;
      mintedGitPOAPCount: number; // The claim IDs must be distinct so we can simply count
      githubUserIds: Set<number>;
    };
    const repoIdToClaimCountsMap: Record<string, RepoIdToClaimCountsMapValue> = {};

    // This helper function is necessary so that we can ensure the same logic is used to
    // count claims regardless if they have pullRequestEarned or mentionEarned non-null
    const handleUserClaim = (repoId: number, githubUserId: number) => {
      const key = repoId.toString();

      if (key in repoIdToClaimCountsMap) {
        repoIdToClaimCountsMap[key].mintedGitPOAPCount++;
        repoIdToClaimCountsMap[key].githubUserIds.add(githubUserId);
      } else {
        repoIdToClaimCountsMap[key] = {
          repoId,
          mintedGitPOAPCount: 1,
          githubUserIds: new Set<number>([githubUserId]),
        };
      }
    };

    // Here we select all (repoId, githubUserId) pairs for CLAIMED claims
    // in the past numDays and then use this data to fill out the
    // repoIdToClaimCountsMap
    (
      await prisma.claim.findMany({
        where: {
          status: ClaimStatus.CLAIMED,
          mintedAt: {
            gte: getXDaysAgoStartDatetime(numDays),
          },
          OR: [{ NOT: { pullRequestEarned: null } }, { NOT: { mentionEarned: null } }],
        },
        select: {
          githubUserId: true,
          pullRequestEarned: {
            select: { repoId: true },
          },
          mentionEarned: {
            select: { repoId: true },
          },
        },
      })
    ).forEach(result => {
      if (result.pullRequestEarned !== null && result.githubUserId !== null) {
        handleUserClaim(result.pullRequestEarned.repoId, result.githubUserId);
      } else if (result.mentionEarned !== null && result.githubUserId !== null) {
        handleUserClaim(result.mentionEarned.repoId, result.githubUserId);
      } else {
        // This SHOULD NOT be able to happen, but unfortunately
        // Prisma doesn't express this in the return type
        logger.error(
          `Prisma returned a row where pullRequestEarned and mentionEarned are null but was requested NOT to`,
        );
      }
    });

    // Here we sort all of the Claim counts in the map by mintedGitPOAPCount
    const allResults: RepoIdToClaimCountsMapValue[] = Object.values(repoIdToClaimCountsMap);
    allResults.sort((left, right) => {
      if (left.mintedGitPOAPCount > right.mintedGitPOAPCount) {
        return -1;
      } else if (left.mintedGitPOAPCount < right.mintedGitPOAPCount) {
        return 1;
      }
      return 0;
    });

    // Now we can limit the results to only at most count records
    const limitedResults = allResults.slice(0, count);

    // Finally we have only count number of records so we can request
    // the additional data necessary to return for the trendingRepos resolver
    // only for the records that we actually need to return
    const results: RepoReturnData[] = [];
    for (const result of limitedResults) {
      const repoData = await prisma.repo.findUnique({
        where: { id: result.repoId },
      });

      // This SHOULD NOT be able to happen since we've just selected the
      // repoIds directly from the DB
      if (repoData === null) {
        logger.error(`Failed to find Repo ID ${result.repoId} in DB`);
        continue;
      }

      // Select the count of GitPOAPs for the Project that contains
      // this specific Repo
      const gitPOAPCount = await prisma.gitPOAP.count({
        where: {
          project: {
            repos: {
              some: { id: result.repoId },
            },
          },
        },
      });

      results.push({
        ...repoData,
        mintedGitPOAPCount: result.mintedGitPOAPCount,
        contributorCount: result.githubUserIds.size,
        gitPOAPCount,
      });
    }

    return results;
  }
}
