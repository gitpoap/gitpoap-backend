import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Organization, OrganizationOrderByWithRelationInput } from '@generated/type-graphql';
import { Context } from '../../context';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';
import { Prisma } from '@prisma/client';

@ObjectType()
class OrganizationData extends Organization {
  @Field()
  contributorCount: number;
  @Field()
  gitPOAPCount: number;
  @Field()
  mintedGitPOAPCount: number;
  @Field()
  projectCount: number;
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

    let results = await prisma.$queryRaw<OrganizationData[]>`
      SELECT  o.*, 
        COUNT(DISTINCT c."userId") AS "contributorCount",
        COUNT(DISTINCT g."id") AS "gitPOAPCount",
        COUNT(c.id) AS "mintedGitPOAPCount",
        COUNT(r.id) AS "projectCount"
      FROM "Organization" as o
      INNER JOIN "Repo" AS r ON r."organizationId" = o.id
      INNER JOIN "GitPOAP" AS g ON g."repoId" = r.id
      INNER JOIN "Claim" AS c ON c."gitPOAPId" = g.id
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
          updatedAt: 'desc',
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
}
