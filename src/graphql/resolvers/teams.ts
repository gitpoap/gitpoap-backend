import {
  GitPOAP,
  GitPOAPRequest,
  NullableStringFieldUpdateOperationsInput,
  StringFieldUpdateOperationsInput,
  Team,
  TeamOrderByWithRelationInput,
} from '@generated/type-graphql';
import { GitPOAPStatus, MembershipRole } from '@prisma/client';
import {
  Authorized,
  Arg,
  Ctx,
  Field,
  InputType,
  ObjectType,
  Resolver,
  Mutation,
  Query,
} from 'type-graphql';
import { hasMembership } from '../../lib/authTokens';
import { AuthRoles } from '../auth';
import { InternalError, TeamNotFoundError } from '../errors';
import { AuthLoggingContext } from '../middleware';

const TeamErrorText = {
  NotAuthorized: 'Not authorized to update Team',
};

const NotAuthorizedError = new Error(TeamErrorText.NotAuthorized);

const ToPOAPApprovalStatus = {
  LIVE: [GitPOAPStatus.APPROVED, GitPOAPStatus.REDEEM_REQUEST_PENDING],
  DEPRECATED: [GitPOAPStatus.DEPRECATED],
  PENDING: [GitPOAPStatus.UNAPPROVED],
};

@InputType()
class TeamUpdateInput {
  @Field({ nullable: true })
  name?: StringFieldUpdateOperationsInput;

  @Field({ nullable: true })
  description?: NullableStringFieldUpdateOperationsInput;
}

@ObjectType()
class TeamUpdatePayload {
  @Field()
  name: string;

  @Field(() => String, { nullable: true })
  description: string | null;
}

@Resolver(() => Team)
export class CustomTeamResolver {
  @Authorized(AuthRoles.Address)
  @Query(() => Team)
  async teamData(
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
    @Arg('teamId') teamId: number,
  ): Promise<Team> {
    logger.info(`Request data for Team: ${teamId}`);

    if (userAccessTokenPayload === null || userAccessTokenPayload.address === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      throw InternalError;
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });
    if (team === null) {
      logger.error(`Failed to look up team with ID: ${teamId}`);
      throw TeamNotFoundError;
    }

    return team;
  }

  @Authorized(AuthRoles.Address)
  @Mutation(() => TeamUpdatePayload)
  async updateTeam(
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
    @Arg('teamId') teamId: number,
    @Arg('input') input: TeamUpdateInput,
  ): Promise<TeamUpdatePayload> {
    if (userAccessTokenPayload === null || userAccessTokenPayload.address === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      throw InternalError;
    }

    logger.info(`Request to data for Team ID ${teamId}`);

    if (
      !hasMembership(userAccessTokenPayload, teamId, [MembershipRole.OWNER, MembershipRole.ADMIN])
    ) {
      logger.warn(
        `Unauthorized Address ID ${userAccessTokenPayload.address.id} tried to update Team ID ${teamId}`,
      );
      throw NotAuthorizedError;
    }

    let name;
    if (input.name !== undefined) {
      name = input.name.set;
    }

    let description;
    if (input.description !== undefined) {
      description = input.description.set;
    }

    const result = await prisma.team.update({
      where: { id: teamId },
      data: {
        name,
        description,
      },
      select: {
        name: true,
        description: true,
      },
    });

    logger.debug(`Completed request to update data for Team ID ${teamId}`);

    return result;
  }

  @Authorized(AuthRoles.Address)
  @Query(() => [GitPOAP])
  async teamGitPOAPs(
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
    @Arg('teamId') teamId: number,
    @Arg('approvalStatus', { defaultValue: null })
    approvalStatus?: 'LIVE' | 'DEPRECATED' | 'PENDING',
    @Arg('sort', { defaultValue: null }) sort?: 'createdAt' | 'updatedAt' | 'alphabetical',
  ): Promise<GitPOAP[]> {
    logger.info(`Request data for Team: ${teamId}`);

    if (userAccessTokenPayload === null || userAccessTokenPayload.address === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      throw InternalError;
    }

    let orderBy: TeamOrderByWithRelationInput;
    switch (sort) {
      case 'createdAt':
        orderBy = { createdAt: 'asc' };
        break;
      case 'updatedAt':
        orderBy = { updatedAt: 'asc' };
        break;
      default:
        orderBy = { name: 'asc' };
        break;
    }

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        gitPOAPs: {
          where: {
            poapApprovalStatus: approvalStatus
              ? { in: [...ToPOAPApprovalStatus[approvalStatus]] }
              : undefined,
          },
          orderBy,
        },
      },
    });
    if (team === null) {
      logger.error(`Failed to look up team with ID: ${teamId}`);
      throw TeamNotFoundError;
    }

    return team.gitPOAPs;
  }

  @Authorized(AuthRoles.Address)
  @Query(() => [GitPOAPRequest])
  async teamGitPOAPRequests(
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
    @Arg('teamId') teamId: number,
    @Arg('approvalStatus', { defaultValue: null })
    approvalStatus?: 'APPROVED' | 'PENDING' | 'REJECTED',
    @Arg('sort', { defaultValue: null }) sort?: 'createdAt' | 'updatedAt' | 'alphabetical',
  ): Promise<GitPOAPRequest[]> {
    logger.info(`Request data for Team: ${teamId}`);

    if (userAccessTokenPayload === null || userAccessTokenPayload.address === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      throw InternalError;
    }

    let orderBy: TeamOrderByWithRelationInput;
    switch (sort) {
      case 'createdAt':
        orderBy = { createdAt: 'asc' };
        break;
      case 'updatedAt':
        orderBy = { updatedAt: 'asc' };
        break;
      default:
        orderBy = { name: 'asc' };
        break;
    }

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        gitPOAPRequests: {
          where: {
            staffApprovalStatus: approvalStatus ?? undefined,
          },
          orderBy,
        },
      },
    });
    if (team === null) {
      logger.error(`Failed to look up team with ID: ${teamId}`);
      throw TeamNotFoundError;
    }

    return team.gitPOAPRequests;
  }
}
