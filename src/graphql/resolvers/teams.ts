import { Authorized, Arg, Ctx, Field, ObjectType, Resolver, Mutation } from 'type-graphql';
import { AuthRoles } from '../auth';
import { AuthLoggingContext } from '../middleware';
import { InternalError } from '../errors';
import { hasMembership } from '../../lib/authTokens';
import { MembershipRole } from '@prisma/client';
import { Team } from '@generated/type-graphql';

const TeamErrorText = {
  NotAuthorized: 'Not authorized to update Team',
};

const NotAuthorizedError = new Error(TeamErrorText.NotAuthorized);

@ObjectType()
class TeamMutationPayload {
  @Field()
  name: string;

  @Field(() => String, { nullable: true })
  description: string | null;
}

@Resolver(() => Team)
export class CustomTeamResolver {
  @Authorized(AuthRoles.Address)
  @Mutation(() => TeamMutationPayload)
  async updateTeamName(
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
    @Arg('teamId') teamId: number,
    @Arg('name') name: string,
  ): Promise<TeamMutationPayload> {
    if (userAccessTokenPayload === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      throw InternalError;
    }

    logger.info(`Request to update name for Team ID ${teamId}`);

    if (
      !hasMembership(userAccessTokenPayload, teamId, [MembershipRole.OWNER, MembershipRole.ADMIN])
    ) {
      logger.warn(
        `Unauthorized Address ID ${userAccessTokenPayload.addressId} tried to update Team ID ${teamId}`,
      );
      throw NotAuthorizedError;
    }

    const result = await prisma.team.update({
      where: { id: teamId },
      data: { name },
      select: {
        name: true,
        description: true,
      },
    });

    logger.debug(`Completed request to update name for Team ID ${teamId}`);

    return result;
  }

  @Authorized(AuthRoles.Address)
  @Mutation(() => TeamMutationPayload)
  async updateDescriptionName(
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
    @Arg('teamId') teamId: number,
    @Arg('description', { nullable: true }) description: string,
  ): Promise<TeamMutationPayload> {
    if (userAccessTokenPayload === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      throw InternalError;
    }

    logger.info(`Request to update description for Team ID ${teamId}`);

    if (
      !hasMembership(userAccessTokenPayload, teamId, [MembershipRole.OWNER, MembershipRole.ADMIN])
    ) {
      logger.warn(
        `Unauthorized Address ID ${userAccessTokenPayload.addressId} tried to update Team ID ${teamId}`,
      );
      throw NotAuthorizedError;
    }

    const result = await prisma.team.update({
      where: { id: teamId },
      data: { description },
      select: {
        name: true,
        description: true,
      },
    });

    logger.debug(`Completed request to update description for Team ID ${teamId}`);

    return result;
  }
}
