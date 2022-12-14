import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import {
  ClaimStatus,
  GithubOrganization,
  GithubOrganizationOrderByWithRelationInput,
} from '@generated/type-graphql';
import { AuthLoggingContext } from '../middleware';
import { Prisma } from '@prisma/client';
import { RepoReturnData } from './repos';

@ObjectType()
class OrganizationData extends GithubOrganization {
  @Field()
  contributorCount: number;
  @Field()
  gitPOAPCount: number;
  @Field()
  mintedGitPOAPCount: number;
  @Field()
  repoCount: number;
}

@Resolver(() => GithubOrganization)
export class CustomOrganizationResolver {
  @Query(() => OrganizationData, { nullable: true })
  async organizationData(
    @Ctx() { prisma, logger }: AuthLoggingContext,
    @Arg('orgId', { defaultValue: null }) orgId?: number,
    @Arg('orgName', { defaultValue: null }) orgName?: string,
  ): Promise<OrganizationData | null> {
    logger.info(`Request data for GithubOrganization: ${orgId ?? orgName}`);

    if (!orgId && !orgName) {
      logger.warn('Either an "orgId" or an "orgName" must be provided');
      return null;
    }

    const results = await prisma.$queryRaw<OrganizationData[]>`
      SELECT o.*,
        COUNT(DISTINCT c."githubUserId")::INTEGER AS "contributorCount",
        COUNT(DISTINCT g.id)::INTEGER AS "gitPOAPCount",
        COUNT(DISTINCT c.id)::INTEGER AS "mintedGitPOAPCount",
        COUNT(DISTINCT r.id)::INTEGER AS "repoCount"
      FROM "GithubOrganization" as o
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
      logger.warn(`Failed to find GithubOrganization: ${orgId ?? orgName}`);
      return null;
    }

    return results[0];
  }

  @Query(() => [GithubOrganization], { nullable: true })
  async allOrganizations(
    @Ctx() { prisma, logger }: AuthLoggingContext,
    @Arg('sort', { defaultValue: 'alphabetical' }) sort: string,
    @Arg('search', { defaultValue: null }) search?: string,
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<GithubOrganization[] | null> {
    logger.info(
      `Request for all organizations using sort ${sort}, search '${search}' with ${perPage} results per page and page ${page}`,
    );

    let orderBy: GithubOrganizationOrderByWithRelationInput;
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
        return null;
    }

    if ((page === null || perPage === null) && page !== perPage) {
      logger.warn('"page" and "perPage" must be specified together');
      return null;
    }

    if (search && search.length < 2) {
      logger.debug('"search" must has more than 2 characters');
      return null;
    }

    let where: Prisma.GithubOrganizationWhereInput | undefined;
    if (search) {
      where = {
        name: { contains: search, mode: 'insensitive' },
      };
    }

    return await prisma.githubOrganization.findMany({
      orderBy,
      skip: page ? (page - 1) * <number>perPage : undefined,
      take: perPage ?? undefined,
      where,
    });
  }

  @Query(() => [RepoReturnData], { nullable: true })
  async organizationRepos(
    @Ctx() { prisma, logger }: AuthLoggingContext,
    @Arg('orgId') orgId: number,
    @Arg('sort', { defaultValue: 'alphabetical' }) sort?: string,
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<RepoReturnData[] | null> {
    logger.info(
      `Request for all repos in GithubOrganization ${orgId} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

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
        return null;
    }

    if ((page === null || perPage === null) && page !== perPage) {
      logger.warn('"page" and "perPage" must be specified together');
      return null;
    }

    const pagination = page
      ? Prisma.sql`OFFSET ${(page - 1) * <number>perPage} ROWS FETCH NEXT ${perPage} ROWS ONLY`
      : Prisma.empty;

    return await prisma.$queryRaw<RepoReturnData[]>`
      SELECT r.*,
        COUNT(DISTINCT c."githubUserId")::INTEGER AS "contributorCount",
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
  }
}
