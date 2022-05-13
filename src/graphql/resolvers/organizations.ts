import { Arg, Ctx, Resolver, Query } from 'type-graphql';
import { Organization, OrganizationOrderByWithRelationInput } from '@generated/type-graphql';
import { Context } from '../../context';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';

@Resolver(of => Organization)
export class CustomOrganizationResolver {
  @Query(returns => [Organization], { nullable: true })
  async allOrganizations(
    @Ctx() { prisma }: Context,
    @Arg('sort', { defaultValue: 'alphabetical' }) sort: string,
    @Arg('order', { defaultValue: 'desc' }) order?: 'asc' | 'desc',
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<Organization[] | null> {
    const logger = createScopedLogger('GQL allOrganizations');

    logger.info(
      `Request for all organizations using sort ${sort}, order ${order}, with ${perPage} results per page and page ${page}`,
    );

    const endTimer = gqlRequestDurationSeconds.startTimer('allOrganizations');

    let orderBy: OrganizationOrderByWithRelationInput;
    switch (sort) {
      case 'alphabetical':
        orderBy = {
          name: order,
        };
        break;
      case 'date':
        orderBy = {
          updatedAt: order,
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
      `Request for all organizations using sort ${sort}, order ${order}, with ${perPage} results per page and page ${page}`,
    );

    endTimer({ success: 1 });

    return results;
  }
}
