import { Authorized, Arg, Ctx, Field, ObjectType, Resolver, Query, Mutation } from 'type-graphql';
import { Membership, MembershipOrderByWithRelationInput } from '@generated/type-graphql';
import { MembershipAcceptanceStatus, MembershipRole } from '@prisma/client';
import { DateTime } from 'luxon';
import { AuthRoles } from '../auth';
import { AuthLoggingContext } from '../middleware';

@ObjectType()
class Error {
  @Field()
  message: string;
}

enum MembershipSort {
  DATE = 'date',
  ROLE = 'role',
  ACCEPTANCE_STATUS = 'acceptance_status',
}

enum MembershipErrorMessage {
  NOT_AUTHENTICATED = 'Not authenticated',
  NOT_AUTHORIZED = 'Not authorized',
  ADDRESS_NOT_FOUND = 'Address not found',
  TEAM_NOT_FOUND = 'Team not found',
  PAGE_NOT_SPECIFIED = 'page not specified',
  MEMBERSHIP_NOT_FOUND = 'Membership not found',
  ALREADY_ACCEPTED = 'Already accepted',
  DB_ERROR = 'Database error',
}

@ObjectType()
class UserMemberships {
  @Field(() => [Membership])
  memberships: Membership[];

  @Field(() => Error)
  error: Error | null;
}

@ObjectType()
class TeamMemberships {
  @Field()
  totalCount: number;

  @Field(() => [Membership])
  memberships: Membership[];

  @Field(() => Error)
  error: Error | null;
}

@ObjectType()
class MembershipMutationPayload {
  @Field(() => Membership)
  membership: Membership | null;

  @Field(() => Error)
  error: Error | null;
}

@Resolver(() => Membership)
export class MembershipResolver {
  @Authorized(AuthRoles.Address)
  @Query(() => UserMemberships, { nullable: true })
  async userMemberships(
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
  ): Promise<UserMemberships> {
    logger.info(`Request for Memberships for address`);

    if (userAccessTokenPayload === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      return {
        memberships: [],
        error: {
          message: MembershipErrorMessage.NOT_AUTHENTICATED,
        },
      };
    }

    const memberships = await prisma.membership.findMany({
      where: {
        address: {
          ethAddress: userAccessTokenPayload.address.toLowerCase(),
        },
      },
    });

    logger.debug(`Completed request for Memberships for address ${userAccessTokenPayload.address}`);

    return {
      memberships,
      error: null,
    };
  }

  @Authorized(AuthRoles.Address)
  @Query(() => TeamMemberships, { nullable: true })
  async teamMemberships(
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
    @Arg('teamId') teamId: number,
    @Arg('sort', { defaultValue: MembershipSort.DATE }) sort: MembershipSort,
    @Arg('perPage', { defaultValue: null }) perPage?: number,
    @Arg('page', { defaultValue: null }) page?: number,
  ): Promise<TeamMemberships> {
    logger.info(
      `Request for Memberships for team ${teamId} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    if (userAccessTokenPayload === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      return {
        totalCount: 0,
        memberships: [],
        error: {
          message: MembershipErrorMessage.NOT_AUTHENTICATED,
        },
      };
    }

    let orderBy: MembershipOrderByWithRelationInput | undefined = undefined;
    switch (sort) {
      case MembershipSort.DATE:
        orderBy = {
          joinedOn: 'desc',
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
        return {
          totalCount: 0,
          memberships: [],
          error: {
            message: `Unknown value provided for sort: ${sort}`,
          },
        };
    }

    if ((page === null || perPage === null) && page !== perPage) {
      logger.warn('"page" and "perPage" must be specified together');
      return {
        totalCount: 0,
        memberships: [],
        error: {
          message: MembershipErrorMessage.PAGE_NOT_SPECIFIED,
        },
      };
    }
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        ownerAddress: true,
      },
    });

    if (team === null) {
      logger.warn('Team not found');
      return {
        totalCount: 0,
        memberships: [],
        error: {
          message: MembershipErrorMessage.TEAM_NOT_FOUND,
        },
      };
    }

    if (
      team.ownerAddress.ethAddress.toLowerCase() !== userAccessTokenPayload.address.toLowerCase()
    ) {
      logger.warn('Not a team owner');
      return {
        totalCount: 0,
        memberships: [],
        error: {
          message: MembershipErrorMessage.NOT_AUTHORIZED,
        },
      };
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

    return {
      totalCount,
      memberships,
      error: null,
    };
  }

  @Authorized(AuthRoles.Address)
  @Mutation(() => MembershipMutationPayload)
  async addNewMembership(
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
    @Arg('teamId') teamId: number,
    @Arg('address') address: string,
  ): Promise<MembershipMutationPayload> {
    logger.info(`Request to add user with address: ${address} as a member to team ${teamId}`);

    if (userAccessTokenPayload === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      return {
        membership: null,
        error: {
          message: MembershipErrorMessage.NOT_AUTHENTICATED,
        },
      };
    }

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        id: true,
        ownerAddress: true,
      },
    });

    if (team === null) {
      logger.warn(`Team not found for teamId: ${teamId}`);
      return {
        membership: null,
        error: {
          message: MembershipErrorMessage.TEAM_NOT_FOUND,
        },
      };
    }

    if (
      team.ownerAddress.ethAddress.toLowerCase() !== userAccessTokenPayload.address.toLowerCase()
    ) {
      logger.warn('Not a team owner');
      return {
        membership: null,
        error: {
          message: MembershipErrorMessage.NOT_AUTHORIZED,
        },
      };
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
      return {
        membership: null,
        error: {
          message: MembershipErrorMessage.ADDRESS_NOT_FOUND,
        },
      };
    }

    let membership: Membership;
    try {
      membership = await prisma.membership.create({
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
    } catch {
      return {
        membership: null,
        error: {
          message: MembershipErrorMessage.DB_ERROR,
        },
      };
    }

    logger.debug(
      `Completed request to add user with address: ${address} as a member to team ${teamId}`,
    );

    return {
      membership,
      error: null,
    };
  }

  @Authorized(AuthRoles.Address)
  @Mutation(() => MembershipMutationPayload)
  async removeMembership(
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
    @Arg('teamId') teamId: number,
    @Arg('address') address: string,
  ): Promise<MembershipMutationPayload> {
    logger.info(`Request to remove a membership from team ${teamId} for address ${address}`);

    if (userAccessTokenPayload === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      return {
        membership: null,
        error: {
          message: MembershipErrorMessage.NOT_AUTHENTICATED,
        },
      };
    }

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        id: true,
        ownerAddress: true,
      },
    });

    if (team === null) {
      logger.warn(`Team not found for teamId: ${teamId}`);
      return {
        membership: null,
        error: {
          message: MembershipErrorMessage.TEAM_NOT_FOUND,
        },
      };
    }

    if (
      team.ownerAddress.ethAddress.toLowerCase() !== userAccessTokenPayload.address.toLowerCase()
    ) {
      logger.warn('Not a team owner');
      return {
        membership: null,
        error: {
          message: MembershipErrorMessage.NOT_AUTHORIZED,
        },
      };
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
      return {
        membership: null,
        error: {
          message: MembershipErrorMessage.ADDRESS_NOT_FOUND,
        },
      };
    }

    const membership = await prisma.membership.findUnique({
      where: {
        teamId_addressId: {
          addressId: addressRecord.id,
          teamId,
        },
      },
    });

    if (membership === null) {
      logger.warn(`Membership not found for address: ${address} in team ${teamId}`);
      return {
        membership: null,
        error: {
          message: MembershipErrorMessage.MEMBERSHIP_NOT_FOUND,
        },
      };
    }

    try {
      await prisma.membership.delete({
        where: {
          teamId_addressId: {
            teamId,
            addressId: addressRecord.id,
          },
        },
      });
    } catch {
      return {
        membership: null,
        error: {
          message: MembershipErrorMessage.DB_ERROR,
        },
      };
    }

    logger.debug(
      `Completed request to remove a membership from team ${teamId} for address ${address}`,
    );

    return {
      membership,
      error: null,
    };
  }

  @Authorized(AuthRoles.Address)
  @Mutation(() => MembershipMutationPayload)
  async acceptMembership(
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
    @Arg('teamId') teamId: number,
  ): Promise<MembershipMutationPayload> {
    logger.info(`Request to accept a membership to team ${teamId}`);

    if (userAccessTokenPayload === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      return {
        membership: null,
        error: {
          message: MembershipErrorMessage.NOT_AUTHENTICATED,
        },
      };
    }

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
      return {
        membership: null,
        error: {
          message: MembershipErrorMessage.TEAM_NOT_FOUND,
        },
      };
    }

    const addressRecord = await prisma.address.findUnique({
      where: {
        ethAddress: userAccessTokenPayload.address.toLowerCase(),
      },
      select: {
        id: true,
      },
    });

    if (addressRecord === null) {
      logger.warn(`Address not found for address: ${userAccessTokenPayload.address}`);
      return {
        membership: null,
        error: {
          message: MembershipErrorMessage.ADDRESS_NOT_FOUND,
        },
      };
    }

    const membership = await prisma.membership.findUnique({
      where: {
        teamId_addressId: {
          teamId,
          addressId: addressRecord.id,
        },
      },
    });

    if (membership === null) {
      logger.warn(
        `Membership not found for team ${teamId} address: ${userAccessTokenPayload.address}`,
      );
      return {
        membership: null,
        error: {
          message: MembershipErrorMessage.MEMBERSHIP_NOT_FOUND,
        },
      };
    }

    if (membership.acceptanceStatus !== MembershipAcceptanceStatus.PENDING) {
      logger.warn(`Membership is already accepted: ${userAccessTokenPayload.address}`);
      return {
        membership: null,
        error: {
          message: MembershipErrorMessage.ALREADY_ACCEPTED,
        },
      };
    }

    let result: Membership;
    try {
      result = await prisma.membership.update({
        where: {
          teamId_addressId: {
            teamId,
            addressId: addressRecord.id,
          },
        },
        data: {
          acceptanceStatus: MembershipAcceptanceStatus.ACCEPTED,
          joinedOn: DateTime.now().toJSDate(),
        },
      });
    } catch {
      return {
        membership: null,
        error: {
          message: MembershipErrorMessage.DB_ERROR,
        },
      };
    }

    logger.debug(
      `Completed request to accept a membership to team ${teamId} for address ${userAccessTokenPayload.address}`,
    );

    return {
      membership: result,
      error: null,
    };
  }
}
