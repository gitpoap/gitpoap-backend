import {
  Authorized,
  Arg,
  Ctx,
  Field,
  InputType,
  ObjectType,
  Resolver,
  Mutation,
} from 'type-graphql';
import { AuthRoles } from '../auth';
import { AuthLoggingContext } from '../middleware';
import { InternalError } from '../errors';
import { hasMembership } from '../../lib/authTokens';
import { MembershipRole } from '@prisma/client';
import {
  Team,
  NullableStringFieldUpdateOperationsInput,
  StringFieldUpdateOperationsInput,
} from '@generated/type-graphql';

const TeamErrorText = {
  NotAuthorized: 'Not authorized to update Team',
};

const NotAuthorizedError = new Error(TeamErrorText.NotAuthorized);

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
  @Mutation(() => TeamUpdatePayload)
  async updateTeam(
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
    @Arg('teamId') teamId: number,
    @Arg('input') input: TeamUpdateInput,
  ): Promise<TeamUpdatePayload> {
    if (userAccessTokenPayload === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      throw InternalError;
    }

    logger.info(`Request to data for Team ID ${teamId}`);

    if (
      !hasMembership(userAccessTokenPayload, teamId, [MembershipRole.OWNER, MembershipRole.ADMIN])
    ) {
      logger.warn(
        `Unauthorized Address ID ${userAccessTokenPayload.addressId} tried to update Team ID ${teamId}`,
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
}
