import { Arg, Ctx, Field, ObjectType, Resolver, Query, Mutation } from 'type-graphql';
import { Membership, MembershipOrderByWithRelationInput } from '@generated/type-graphql';
import { MembershipAcceptanceStatus, MembershipRole } from '@prisma/client';
import { Context } from '../../context';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';

@ObjectType()
class UserMemberships {
  @Field(() => [Membership])
  memberships: Membership[];
}

@ObjectType()
class TeamMemberships {
  @Field()
  totalCount: number;

  @Field(() => [Membership])
  memberships: Membership[];
}

enum MembershipSort {
  DATE = 'date',
  ROLE = 'role',
  ACCEPTANCE_STATUS = 'acceptance_status',
}

@Resolver(() => Membership)
export class MembershipResolver {
  @Query(() => UserMemberships, { nullable: true })
  async userMemberships(
    @Ctx() { prisma }: Context,
    @Arg('address') address: string,
  ): Promise<UserMemberships | null> {
    const logger = createScopedLogger('GQL userMemberships');

    logger.info(`Request for Memberships for address ${address}`);

    const endTimer = gqlRequestDurationSeconds.startTimer('userMemberships');

    const memberships = await prisma.membership.findMany({
      where: {
        address: {
          ethAddress: address.toLowerCase(),
        },
      },
    });

    logger.debug(`Completed request for Memberships for address ${address}`);

    endTimer({ success: 1 });

    return {
      memberships,
    };
  }

  @Query(() => TeamMemberships, { nullable: true })
  async teamMemberships(
    @Ctx() { prisma }: Context,
    @Arg('teamId') teamId: number,
    @Arg('sort', { defaultValue: MembershipSort.DATE }) sort: MembershipSort,
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<TeamMemberships | null> {
    const logger = createScopedLogger('GQL teamMemberships');

    logger.info(
      `Request for Memberships for team ${teamId} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    const endTimer = gqlRequestDurationSeconds.startTimer('teamMemberships');

    let orderBy: MembershipOrderByWithRelationInput | undefined = undefined;
    switch (sort) {
      case MembershipSort.DATE:
        orderBy = {
          createdAt: 'desc',
        };
        break;
      case MembershipSort.ROLE:
        orderBy = {
          role: 'asc',
        };
        break;
      case MembershipSort.ACCEPTANCE_STATUS:
        orderBy = {
          acceptanceStatus: 'asc',
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
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
    });

    if (team === null) {
      logger.warn('Team not found');
      endTimer({ success: 0 });
      return null;
    }

    const totalCount = await prisma.membership.count({
      where: {
        team: {
          id: teamId,
        },
      },
    });

    const memberships = await prisma.membership.findMany({
      orderBy,
      skip: page ? (page - 1) * <number>perPage : undefined,
      take: perPage ?? undefined,
      where: {
        team: {
          id: teamId,
        },
      },
    });

    logger.debug(
      `Completed request for Memberships for team ${teamId} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    endTimer({ success: 1 });

    return {
      totalCount,
      memberships,
    };
  }

  @Mutation(() => Membership)
  async addNewMembership(
    @Ctx() { prisma }: Context,
    @Arg('teamId') teamId: number,
    @Arg('address') address: string,
  ): Promise<Membership | null> {
    const logger = createScopedLogger('GQL addNewMembership');

    logger.info(`Request to add user with address: ${address} as a member to team ${teamId}`);

    const endTimer = gqlRequestDurationSeconds.startTimer('addNewMembership');

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        id: true,
      },
    });

    if (team === null) {
      logger.warn(`Team not found for teamId: ${teamId}`);
      endTimer({ success: 0 });
      return null;
    }

    const addressRecord = await prisma.address.findUnique({
      where: {
        ethAddress: address.toLowerCase(),
      },
      select: {
        id: true,
      },
    });

    if (addressRecord === null) {
      logger.warn(`Address not found for address: ${address}`);
      endTimer({ success: 0 });
      return null;
    }

    const result = await prisma.membership.create({
      data: {
        team: {
          connect: {
            id: teamId,
          },
        },
        address: {
          connect: {
            ethAddress: address.toLowerCase(),
          },
        },
        role: MembershipRole.ADMIN,
        acceptanceStatus: MembershipAcceptanceStatus.PENDING,
      },
    });

    logger.debug(
      `Completed request to add user with address: ${address} as a member to team ${teamId}`,
    );

    endTimer({ success: 1 });

    return result;
  }

  @Mutation(() => Membership)
  async removeMembership(
    @Ctx() { prisma }: Context,
    @Arg('teamId') teamId: number,
    @Arg('address') address: string,
  ): Promise<Membership | null> {
    const logger = createScopedLogger('GQL removeMembership');

    logger.info(`Request for removing a membership from team ${teamId} for address ${address}`);

    const endTimer = gqlRequestDurationSeconds.startTimer('removeMembership');

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        id: true,
      },
    });

    if (team === null) {
      logger.warn(`Team not found for teamId: ${teamId}`);
      endTimer({ success: 0 });
      return null;
    }

    const addressRecord = await prisma.address.findUnique({
      where: {
        ethAddress: address.toLowerCase(),
      },
      select: {
        id: true,
      },
    });

    if (addressRecord === null) {
      logger.warn(`Address not found for address: ${address}`);
      endTimer({ success: 0 });
      return null;
    }

    const result = await prisma.membership.delete({
      where: {
        teamId_addressId: {
          teamId,
          addressId: addressRecord.id,
        },
      },
    });

    logger.debug(
      `Completed request for removing a membership from team ${teamId} for address ${address}`,
    );

    endTimer({ success: 1 });

    return result;
  }

  @Mutation(() => Membership)
  async acceptMembership(
    @Ctx() { prisma }: Context,
    @Arg('teamId') teamId: number,
    @Arg('address') address: string, // once we implement gql auth, we don't need this arg
  ): Promise<Membership | null> {
    const logger = createScopedLogger('GQL acceptMembership');

    logger.info(`Request for accepting a membership to team ${teamId} for address ${address}`);

    const endTimer = gqlRequestDurationSeconds.startTimer('acceptMembership');

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        id: true,
      },
    });

    if (team === null) {
      logger.warn(`Team not found for teamId: ${teamId}`);
      endTimer({ success: 0 });
      return null;
    }

    const addressRecord = await prisma.address.findUnique({
      where: {
        ethAddress: address.toLowerCase(),
      },
      select: {
        id: true,
      },
    });

    if (addressRecord === null) {
      logger.warn(`Address not found for address: ${address}`);
      endTimer({ success: 0 });
      return null;
    }

    const membershipRecord = await prisma.membership.findUnique({
      where: {
        teamId_addressId: {
          teamId,
          addressId: addressRecord.id,
        },
      },
    });

    if (membershipRecord === null) {
      logger.warn(`Membership not found for team ${teamId} address: ${address}`);
      endTimer({ success: 0 });
      return null;
    }

    if (membershipRecord.acceptanceStatus !== MembershipAcceptanceStatus.PENDING) {
      logger.warn(`Membership is already accepted: ${address}`);
      endTimer({ success: 0 });
      return null;
    }

    const result = await prisma.membership.update({
      where: {
        teamId_addressId: {
          teamId,
          addressId: addressRecord.id,
        },
      },
      data: {
        acceptanceStatus: MembershipAcceptanceStatus.ACCEPTED,
      },
    });

    logger.debug(
      `Completed request for accepting a membership to team ${teamId} for address ${address}`,
    );

    endTimer({ success: 1 });

    return result;
  }
}
