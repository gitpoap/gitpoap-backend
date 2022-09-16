import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import {
  ClaimStatus,
  Organization,
  OrganizationOrderByWithRelationInput,
} from '@generated/type-graphql';
import { Context } from '../../context';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';
import { Prisma } from '@prisma/client';
import { RepoReturnData } from './repos';

@ObjectType()
class OrganizationData extends Organization {
  @Field()
  contributorCount: number;
  @Field()
  gitPOAPCount: number;
  @Field()
  mintedGitPOAPCount: number;
  @Field()
  repoCount: number;
}

@Resolver(of => Organization)
export class CustomOrganizationResolver {
  @Query(returns => OrganizationData, { nullable: true })
  async organizationData(
    @Ctx() { prisma }: Context,
    @Arg('orgId', { defaultValue: null }) orgId?: number,
    @Arg('orgName', { defaultValue: null }) orgName?: string,
  ): Promise<OrganizationData | null> {
    const logger = createScopedLogger('GQL organizationData');

    logger.info(`Request data for organization: ${orgId ?? orgName}`);

    const endTimer = gqlRequestDurationSeconds.startTimer('organizationData');

    if (!orgId && !orgName) {
      logger.warn('Either an "orgId" or an "orgName" must be provided');
      endTimer({ success: 0 });
      return null;
    }

    const results = await prisma.$queryRaw<OrganizationData[]>`
      SELECT o.*,
        COUNT(DISTINCT c."userId")::INTEGER AS "contributorCount",
        COUNT(DISTINCT g.id)::INTEGER AS "gitPOAPCount",
        COUNT(DISTINCT c.id)::INTEGER AS "mintedGitPOAPCount",
        COUNT(DISTINCT r.id)::INTEGER AS "repoCount"
      FROM "Organization" as o
      INNER JOIN "Repo" AS r ON r."organizationId" = o.id
      INNER JOIN "Project" AS p ON r."projectId" = p.id
      INNER JOIN "GitPOAP" AS g ON g."projectId" = p.id AND g."isEnabled" IS TRUE
      LEFT JOIN
        (
          SELECT * FROM "Claim"
          WHERE status = ${ClaimStatus.CLAIMED}::"ClaimStatus"
        ) AS c ON c."gitPOAPId" = g.id
      WHERE ${orgId ? Prisma.sql`o.id = ${orgId}` : Prisma.sql`o.name = ${orgName}`}
      GROUP BY o.id
    `;

    if (results.length === 0) {
      logger.warn(`Failed to find organization: ${orgId ?? orgName}`);
      endTimer({ success: 0 });
      return null;
    }

    logger.debug(`Completed request data for organization: ${orgId ?? orgName}`);

    endTimer({ success: 1 });

    return results[0];
  }

  @Query(returns => [Organization], { nullable: true })
  async allOrganizations(
    @Ctx() { prisma }: Context,
    @Arg('sort', { defaultValue: 'alphabetical' }) sort: string,
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<Organization[] | null> {
    const logger = createScopedLogger('GQL allOrganizations');

    logger.info(
      `Request for all organizations using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    const endTimer = gqlRequestDurationSeconds.startTimer('allOrganizations');

    let orderBy: OrganizationOrderByWithRelationInput;
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

    const results = await prisma.organization.findMany({
      orderBy,
      skip: page ? (page - 1) * <number>perPage : undefined,
      take: perPage ?? undefined,
    });

    logger.info(
      `Request for all organizations using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    endTimer({ success: 1 });

    return results;
  }

  @Query(returns => [RepoReturnData], { nullable: true })
  async organizationRepos(
    @Ctx() { prisma }: Context,
    @Arg('orgId') orgId: number,
    @Arg('sort', { defaultValue: 'alphabetical' }) sort?: string,
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<RepoReturnData[] | null> {
    const logger = createScopedLogger('GQL organizationRepos');

    logger.info(
      `Request for all repos in organization ${orgId} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    const endTimer = gqlRequestDurationSeconds.startTimer('allRepos');

    let orderBy;
    switch (sort) {
      case 'alphabetical':
        orderBy = Prisma.sql`r.name ASC`;
        break;
      case 'date':
        orderBy = Prisma.sql`r."createdAt" DESC`;
        break;
      case 'contributor-count':
        orderBy = Prisma.sql`"contributorCount" DESC`;
        break;
      case 'minted-count':
        orderBy = Prisma.sql`"mintedGitPOAPCount" DESC`;
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

    const pagination = page
      ? Prisma.sql`OFFSET ${(page - 1) * <number>perPage} ROWS FETCH NEXT ${perPage} ROWS ONLY`
      : Prisma.empty;

    const results = await prisma.$queryRaw<RepoReturnData[]>`
      SELECT r.*,
        COUNT(DISTINCT c."userId")::INTEGER AS "contributorCount",
        COUNT(DISTINCT g.id)::INTEGER AS "gitPOAPCount",
        COUNT(DISTINCT c.id)::INTEGER AS "mintedGitPOAPCount"
      FROM "Repo" as r
      INNER JOIN "Project" AS p ON p.id = r."projectId"
      INNER JOIN "GitPOAP" AS g ON g."projectId" = p.id AND g."isEnabled" IS TRUE
      LEFT JOIN
        (
          SELECT * FROM "Claim"
          WHERE status = ${ClaimStatus.CLAIMED}::"ClaimStatus"
        ) AS c ON c."gitPOAPId" = g.id
      WHERE r."organizationId" = ${orgId}
      GROUP BY r.id
      ORDER BY ${orderBy}
      ${pagination}
    `;

    logger.info(
      `Request for all repos in organization ${orgId} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    endTimer({ success: 1 });

    return results;
  }
}
