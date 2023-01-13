import { Authorized, Arg, Ctx, Field, ObjectType, Resolver, Query, Mutation } from 'type-graphql';
import {
  MembershipOrderByWithRelationInput,
  Address,
  Membership,
  Team,
} from '@generated/type-graphql';
import { MembershipAcceptanceStatus, MembershipRole } from '@prisma/client';
import { DateTime } from 'luxon';
import { AuthRoles } from '../auth';
import { AuthLoggingContext } from '../middleware';
import { InternalError } from '../errors';

enum MembershipSort {
  DATE = 'date',
  ROLE = 'role',
  ACCEPTANCE_STATUS = 'acceptance_status',
}

enum MembershipErrorMessage {
  NOT_AUTHORIZED = 'Not authorized',
  ADDRESS_NOT_FOUND = 'Address not found',
  TEAM_NOT_FOUND = 'Team not found',
  PAGE_NOT_SPECIFIED = 'page not specified',
  MEMBERSHIP_NOT_FOUND = 'Membership not found',
  ALREADY_ACCEPTED = 'Already accepted',
  ALREADY_EXISTS = 'Already Exists',
}

@ObjectType()
class MembershipWithTeam extends Membership {
  @Field(() => Team)
  team?: Team;

  @Field(() => Address)
  address?: Address;
}

@ObjectType()
class UserMemberships {
  @Field(() => [MembershipWithTeam])
  memberships: MembershipWithTeam[];
}

@ObjectType()
class TeamMemberships {
  @Field()
  total: number;

  @Field(() => [MembershipWithTeam])
  memberships: MembershipWithTeam[];
}

@ObjectType()
class MembershipMutationPayload {
  @Field(() => MembershipWithTeam, { nullable: true })
  membership: MembershipWithTeam | null;
}

@Resolver(() => Membership)
export class CustomMembershipResolver {
  @Authorized(AuthRoles.Address)
  @Query(() => UserMemberships, { nullable: true })
  async userMemberships(
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
  ): Promise<UserMemberships> {
    if (userAccessTokenPayload === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      throw InternalError;
    }

    logger.info(`Request for Memberships for address ${userAccessTokenPayload.address}`);

    const memberships = await prisma.membership.findMany({
      where: {
        address: {
          ethAddress: userAccessTokenPayload.address.toLowerCase(),
        },
      },
      include: {
        team: true,
        address: true,
      },
    });

    logger.debug(`Completed request for Memberships for address ${userAccessTokenPayload.address}`);

    return { memberships };
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
      throw InternalError;
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
    }

    if ((page === null || perPage === null) && page !== perPage) {
      logger.warn('"page" and "perPage" must be specified together');
      throw new Error(MembershipErrorMessage.PAGE_NOT_SPECIFIED);
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
      throw new Error(MembershipErrorMessage.TEAM_NOT_FOUND);
    }

    const membership = await prisma.membership.findUnique({
      where: {
        teamId_addressId: {
          teamId,
          addressId: userAccessTokenPayload.addressId,
        },
      },
    });

    if (membership === null) {
      logger.warn('Not a team member');
      throw new Error(MembershipErrorMessage.NOT_AUTHORIZED);
    }

    const total = await prisma.membership.count({
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
      include: {
        team: true,
        address: true,
      },
    });

    logger.debug(
      `Completed request for Memberships for team ${teamId} using sort ${sort}, with ${perPage} results per page and page ${page}`,
    );

    return {
      total,
      memberships,
    };
  }

  @Authorized(AuthRoles.Address)
  @Mutation(() => MembershipMutationPayload)
  async addNewMembership(
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
    @Arg('teamId') teamId: number,
    @Arg('address') address: string,
  ): Promise<MembershipMutationPayload> {
    if (userAccessTokenPayload === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      throw InternalError;
    }

    logger.info(`Request to add user with address: ${address} as a member to team ${teamId}`);

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
      throw new Error(MembershipErrorMessage.TEAM_NOT_FOUND);
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
      throw new Error(MembershipErrorMessage.ADDRESS_NOT_FOUND);
    }

    const userMembership = await prisma.membership.findUnique({
      where: {
        teamId_addressId: {
          addressId: userAccessTokenPayload.addressId,
          teamId,
        },
      },
    });

    if (userMembership === null || userMembership.role === MembershipRole.MEMBER) {
      logger.warn('Not the team admin');
      throw new Error(MembershipErrorMessage.NOT_AUTHORIZED);
    }

    const membershipRecord = await prisma.membership.findUnique({
      where: {
        teamId_addressId: {
          teamId,
          addressId: addressRecord.id,
        },
      },
    });

    if (membershipRecord !== null) {
      logger.warn(`Membership for address ${address} in team ${teamId} already exists`);
      throw new Error(MembershipErrorMessage.ALREADY_EXISTS);
    }

    const membership = await prisma.membership.create({
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

    return {
      membership,
    };
  }

  @Authorized(AuthRoles.Address)
  @Mutation(() => MembershipMutationPayload)
  async removeMembership(
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
    @Arg('membershipId') membershipId: number,
  ): Promise<MembershipMutationPayload> {
    logger.info(`Request to remove a membership ${membershipId}`);

    if (userAccessTokenPayload === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      throw InternalError;
    }

    const membership = await prisma.membership.findUnique({
      where: {
        id: membershipId,
      },
      select: {
        id: true,
        team: {
          select: {
            ownerAddress: true,
            id: true,
          },
        },
        address: {
          select: {
            ethAddress: true,
          },
        },
        acceptanceStatus: true,
      },
    });

    if (membership === null) {
      logger.warn(`Membership not found for membershipId: ${membershipId}`);
      throw new Error(MembershipErrorMessage.MEMBERSHIP_NOT_FOUND);
    }
    const userMembership = await prisma.membership.findUnique({
      where: {
        teamId_addressId: {
          addressId: userAccessTokenPayload.addressId,
          teamId: membership.team.id,
        },
      },
    });

    if (
      (userMembership === null || userMembership.role === MembershipRole.MEMBER) &&
      membership.acceptanceStatus === MembershipAcceptanceStatus.PENDING &&
      userAccessTokenPayload.address.toLowerCase() !== membership.address.ethAddress.toLowerCase()
    ) {
      logger.warn('Not the team owner nor invited member');
      throw new Error(MembershipErrorMessage.NOT_AUTHORIZED);
    }

    const result = await prisma.membership.delete({
      where: {
        id: membershipId,
      },
      include: {
        team: true,
        address: true,
      },
    });

    logger.debug(`Completed request to Request to remove a membership ${membershipId}`);

    return {
      membership: result,
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
      throw InternalError;
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
      throw new Error(MembershipErrorMessage.TEAM_NOT_FOUND);
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
      throw new Error(MembershipErrorMessage.ADDRESS_NOT_FOUND);
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
      throw new Error(MembershipErrorMessage.MEMBERSHIP_NOT_FOUND);
    }

    if (membership.acceptanceStatus !== MembershipAcceptanceStatus.PENDING) {
      logger.warn(`Membership is already accepted: ${userAccessTokenPayload.address}`);
      throw new Error(MembershipErrorMessage.ALREADY_ACCEPTED);
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
        joinedOn: DateTime.now().toJSDate(),
      },
    });

    logger.debug(
      `Completed request to accept a membership to team ${teamId} for address ${userAccessTokenPayload.address}`,
    );

    return {
      membership: result,
    };
  }
}
