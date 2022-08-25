import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import {
  ClaimStatus,
  GitPOAPStatus,
  Repo,
  RepoOrderByWithRelationInput,
} from '@generated/type-graphql';
import { getLastMonthStartDatetime, getXDaysAgoStartDatetime } from './util';
import { Context } from '../../context';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';
import { getGithubRepositoryStarCount } from '../../external/github';
import { Prisma } from '@prisma/client';

@ObjectType()
export class RepoReturnData extends Repo {
  @Field()
  contributorCount: number;
  @Field()
  gitPOAPCount: number;
  @Field()
  mintedGitPOAPCount: number;
}

@Resolver(of => Repo)
export class CustomRepoResolver {
  @Query(returns => RepoReturnData, { nullable: true })
  async repoData(
    @Ctx() { prisma }: Context,
    @Arg('repoId', { defaultValue: null }) repoId?: number,
    @Arg('orgName', { defaultValue: null }) orgName?: string,
    @Arg('repoName', { defaultValue: null }) repoName?: string,
  ): Promise<RepoReturnData | null> {
    const logger = createScopedLogger('GQL repoData');

    logger.info(`Request data for repo: ${repoId}`);

    const endTimer = gqlRequestDurationSeconds.startTimer('repoData');

    let results;

    if (repoId) {
      results = await prisma.$queryRaw<RepoReturnData[]>`
        SELECT r.*, 
          COUNT(DISTINCT c."userId")::INTEGER AS "contributorCount",
          COUNT(DISTINCT g.id)::INTEGER AS "gitPOAPCount",
          COUNT(c.id)::INTEGER AS "mintedGitPOAPCount"
        FROM "Repo" as r
        INNER JOIN "Project" AS p ON r."projectId" = p.id
        INNER JOIN "GitPOAP" AS g ON g."projectId" = p.id
          AND g."isEnabled" IS TRUE
          AND g.status != ${GitPOAPStatus.DEPRECATED}::"GitPOAPStatus"
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
        endTimer({ success: 0 });
        return null;
      }

      logger.debug(`Completed request for data from repo: ${repoId}`);
    } else if (orgName && repoName) {
      results = await prisma.$queryRaw<RepoReturnData[]>`
        SELECT r.*, 
          COUNT(DISTINCT c."userId")::INTEGER AS "contributorCount",
          COUNT(DISTINCT g.id)::INTEGER AS "gitPOAPCount",
          COUNT(c.id)::INTEGER AS "mintedGitPOAPCount"
        FROM "Repo" as r
        INNER JOIN "Organization" AS o ON o.id = r."organizationId"
        INNER JOIN "Project" AS p ON r."projectId" = p.id
        INNER JOIN "GitPOAP" AS g ON g."projectId" = p.id
          AND g."isEnabled" IS TRUE
          AND g.status != ${GitPOAPStatus.DEPRECATED}::"GitPOAPStatus"
        LEFT JOIN 
          (
            SELECT * FROM "Claim"
            WHERE status = ${ClaimStatus.CLAIMED}::"ClaimStatus"
          ) AS c ON c."gitPOAPId" = g.id
        WHERE o.name = ${orgName} AND r.name = ${repoName}
        GROUP BY r.id
      `;

      if (results.length === 0) {
        logger.warn(`Failed to find repo with orgName: ${orgName} and repoName: ${repoName}`);
        endTimer({ success: 0 });
        return null;
      }

      logger.debug(`Completed request for data from repo: ${orgName}/${repoName}`);
    } else if (!orgName !== !repoName) {
      logger.warn('"orgName" and "repoName" must be specified together');
      endTimer({ success: 0 });
      return null;
    } else {
      logger.warn('Either a "repoId" or both "orgName" and "repoName" must be provided');
      endTimer({ success: 0 });
      return null;
    }

    endTimer({ success: 1 });

    return results[0];
  }

  @Query(returns => Number)
  async repoStarCount(
    @Ctx() { prisma }: Context,
    @Arg('repoId') repoId: number,
  ): Promise<Number | null> {
    const logger = createScopedLogger('GQL repoStarCount');

    logger.info(`Request for star count of repo id: ${repoId}`);

    const endTimer = gqlRequestDurationSeconds.startTimer('repoStarCount');

    const repo = await prisma.repo.findUnique({
      where: { id: repoId },
      select: { githubRepoId: true },
    });

    if (repo === null) {
      logger.warn(`Failed to find repo with id: ${repoId}`);
      endTimer({ success: 0 });
      return null;
    }

    // This returns 0 if there's an error or repo doesn't exist
    const result = await getGithubRepositoryStarCount(repo.githubRepoId);

    logger.debug(`Completed request for star count of repo id: ${repoId}`);

    endTimer({ success: 1 });

    return result;
  }

  @Query(returns => Number)
  async totalRepos(@Ctx() { prisma }: Context): Promise<Number> {
    const logger = createScopedLogger('GQL totalRepos');

    logger.info('Request for total number of repos');

    const endTimer = gqlRequestDurationSeconds.startTimer('totalRepos');

    const result = await prisma.repo.count();

    logger.debug('Completed request for total number of repos');

    endTimer({ success: 1 });

    return result;
  }

  @Query(returns => Number)
  async lastMonthRepos(@Ctx() { prisma }: Context): Promise<Number> {
    const logger = createScopedLogger('GQL lastMonthRepos');

    logger.info("Request for count of last month's new repos");

    const endTimer = gqlRequestDurationSeconds.startTimer('lastMonthRepos');

    const result = await prisma.repo.aggregate({
      _count: {
        id: true,
      },
      where: {
        createdAt: { gt: getLastMonthStartDatetime() },
      },
    });

    logger.debug("Completed request for count of last month's new repos");

    endTimer({ success: 1 });

    return result._count.id;
  }

  @Query(returns => [Repo])
  async recentlyAddedRepos(
    @Ctx() { prisma }: Context,
    @Arg('count', { defaultValue: 10 }) count: number,
  ): Promise<Repo[]> {
    const logger = createScopedLogger('GQL recentlyAddedRepos');

    logger.info(`Request for the ${count} most recently added repos`);

    const endTimer = gqlRequestDurationSeconds.startTimer('recentlyAddedRepos');

    const results = await prisma.repo.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: count,
      include: {
        organization: true,
      },
    });

    logger.debug(`Completed request for the ${count} most recently added repos`);

    endTimer({ success: 1 });

    return results;
  }

  @Query(returns => [Repo], { nullable: true })
  async allRepos(
    @Ctx() { prisma }: Context,
    @Arg('sort', { defaultValue: 'alphabetical' }) sort: string,
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<Repo[] | null> {
    const logger = createScopedLogger('GQL allRepos');

    logger.info(
      `Request for all repos using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    const endTimer = gqlRequestDurationSeconds.startTimer('allRepos');

    let orderBy: RepoOrderByWithRelationInput | undefined = undefined;
    switch (sort) {
      case 'alphabetical':
        orderBy = {
          name: 'asc',
        };
        break;
      case 'date':
        orderBy = {
          createdAt: 'desc',
        };
        break;
      case 'gitpoap-count':
        break;
      case 'organization':
        orderBy = {
          organization: {
            name: 'asc',
          },
        };
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

    let results: Repo[];
    if (sort !== 'gitpoap-count') {
      results = await prisma.repo.findMany({
        orderBy,
        skip: page ? (page - 1) * <number>perPage : undefined,
        take: perPage ?? undefined,
      });
    } else {
      // Unfortunately prisma doesn't allow us to sort on relations two levels down
      const skip = page ? Prisma.sql`OFFSET ${(page - 1) * <number>perPage}` : Prisma.empty;
      const take = perPage ? Prisma.sql`LIMIT ${perPage}` : Prisma.empty;
      results = await prisma.$queryRaw<Repo[]>`
        SELECT r.* FROM "Repo" AS r
        INNER JOIN "Project" AS p ON p.id = r."projectId"
        INNER JOIN "GitPOAP" AS g ON g."projectId" = p.id AND g.status != ${GitPOAPStatus.DEPRECATED}
        LEFT JOIN "Claim" AS c ON c."gitPOAPId" = g.id AND c.status = 'CLAIMED'
        GROUP BY r.id
        ORDER BY COUNT(c.id) DESC
        ${skip} ${take}
      `;
    }

    logger.debug(
      `Completed request for all repos using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    endTimer({ success: 1 });

    return results;
  }

  @Query(returns => [RepoReturnData], { nullable: true })
  async trendingRepos(
    @Ctx() { prisma }: Context,
    @Arg('count', { defaultValue: 10 }) count: number,
    @Arg('numDays', { defaultValue: 3 }) numDays: number,
  ): Promise<RepoReturnData[] | null> {
    const logger = createScopedLogger('GQL trendingRepos');

    logger.info(`Request for trending repos form the last ${numDays} days`);

    const endTimer = gqlRequestDurationSeconds.startTimer('trendingRepos');

    const results = await prisma.$queryRaw<RepoReturnData[]>`
      SELECT r.*, 
          COUNT(DISTINCT c."userId")::INTEGER AS "contributorCount",
          COUNT(DISTINCT g.id)::INTEGER AS "gitPOAPCount",
          COUNT(c.id)::INTEGER AS "mintedGitPOAPCount"
        FROM "Repo" as r
        INNER JOIN "Project" AS p ON r."projectId" = p.id
        INNER JOIN "GitPOAP" AS g ON g."projectId" = p.id
        LEFT JOIN "Claim" AS c ON c."gitPOAPId" = g.id 
          AND c."status" = 'CLAIMED' 
          AND c."mintedAt" >= ${getXDaysAgoStartDatetime(numDays)}
        GROUP BY r.id
        ORDER BY "mintedGitPOAPCount" DESC
        LIMIT ${count}
    `;

    endTimer({ success: 1 });

    return results;
  }
}
