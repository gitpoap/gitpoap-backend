import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Membership, MembershipOrderByWithRelationInput } from '@generated/type-graphql';
import { Context } from '../../context';
import { resolveENS } from '../../lib/ens';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';

@ObjectType()
class UserMemberships {
  @Field()
  totalMembershipCount: number;

  @Field(() => [Membership])
  memberships: Membership[];
}

@Resolver(() => Membership)
export class MembershipResolver {
  @Query(() => UserMemberships, { nullable: true })
  async userMemberships(
    @Ctx() { prisma }: Context,
    @Arg('address') address: string,
    @Arg('sort', { defaultValue: 'date' }) sort: string,
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<UserMemberships | null> {
    const logger = createScopedLogger('GQL userMemberships');

    logger.info(
      `Request for Memberships for address ${address} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    const endTimer = gqlRequestDurationSeconds.startTimer('userMemberships');

    let orderBy: MembershipOrderByWithRelationInput | undefined = undefined;
    switch (sort) {
      case 'date':
        orderBy = {
          createdAt: 'desc',
        };
        break;
      case 'team':
        orderBy = {
          team: {
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

    // Resolve ENS if provided
    const resolvedAddress = await resolveENS(address);
    if (resolvedAddress === null) {
      logger.warn('The address provided is invalid');
      endTimer({ success: 0 });
      return null;
    }

    const result: UserMemberships = {
      totalMembershipCount: 0,
      memberships: [],
    };

    result.totalMembershipCount = await prisma.membership.count({
      where: {
        address: {
          ethAddress: address,
        },
      },
    });

    result.memberships = await prisma.membership.findMany({
      orderBy,
      skip: page ? (page - 1) * <number>perPage : undefined,
      take: perPage ?? undefined,
      where: {
        address: {
          ethAddress: address,
        },
      },
    });

    logger.debug(
      `Completed request for POAPs for address ${address} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    endTimer({ success: 1 });

    return result;
  }
}
