import { Arg, Ctx, Resolver, Query } from 'type-graphql';
import { ClaimStatus, Profile, Repo } from '@generated/type-graphql';
import { ProfileWithClaimsCount } from './profiles';
import { getLastMonthStartDatetime } from './util';
import { Context } from '../../context';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';

@Resolver(of => Repo)
export class CustomRepoResolver {
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
  async recentlyAddedProjects(
    @Ctx() { prisma }: Context,
    @Arg('count', { defaultValue: 10 }) count: number,
  ): Promise<Repo[]> {
    const logger = createScopedLogger('GQL recentlyAddedProjects');

    logger.info(`Request for the ${count} most recently added projects`);

    const endTimer = gqlRequestDurationSeconds.startTimer('recentlyAddedProjects');

    const results = await prisma.repo.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: count,
      include: {
        organization: true,
      },
    });

    logger.debug(`Completed request for the ${count} most recently added projects`);

    endTimer({ success: 1 });

    return results;
  }

  @Query(returns => [ProfileWithClaimsCount])
  async repoMostHonoredContributors(
    @Ctx() { prisma }: Context,
    @Arg('count', { defaultValue: 10 }) count: Number,
    @Arg('repoId') repoId: number,
  ): Promise<ProfileWithClaimsCount[]> {
    const logger = createScopedLogger('GQL repoMostHonoredContributors');

    logger.info(`Request for repo ${repoId}'s ${count} most honored contributors `);

    const endTimer = gqlRequestDurationSeconds.startTimer('repoMostHonoredContributors');

    type ResultType = Profile & {
      claimsCount: Number;
    };

    const results: ResultType[] = await prisma.$queryRaw`
      SELECT p.*, COUNT(c.id) AS "claimsCount"
      FROM "Profile" AS p
      JOIN "Claim" AS c ON c.address = p.address
      JOIN "GitPOAP" AS gp ON gp.id = c."gitPOAPId"
      WHERE c.status = ${ClaimStatus.CLAIMED}
      AND gp."repoId" = ${repoId}
      GROUP BY p.id
      ORDER BY "claimsCount" DESC
      LIMIT ${count}
    `;

    let finalResults = [];

    for (const result of results) {
      const { claimsCount, ...profile } = result;

      finalResults.push({ profile, claimsCount });
    }

    logger.debug(`Completed request for repo ${repoId}'s ${count} most honored contributors`);

    endTimer({ success: 1 });

    return finalResults;
  }
}
