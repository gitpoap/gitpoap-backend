import { Ctx, Field, ObjectType, Resolver, Query, Authorized } from 'type-graphql';
import { CGsWhitelist } from '../../constants';
import { isAddressAStaffMember, isGithubIdAStaffMember } from '../../lib/staff';
import { AuthRoles } from '../auth';
import { InternalError } from '../errors';
import { AuthLoggingContext } from '../middleware';

@ObjectType()
class Permissions {
  @Field(() => Boolean)
  canCreateCGs: boolean;

  @Field(() => Boolean)
  isStaff: boolean;
}

@Resolver(() => Permissions)
export class CustomPermissionsResolver {
  @Authorized(AuthRoles.Address)
  @Query(() => Permissions)
  async userPermissions(
    @Ctx() { userAccessTokenPayload, logger }: AuthLoggingContext,
  ): Promise<Permissions> {
    logger.info("Request for logged-in user's permissions");

    if (userAccessTokenPayload === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      throw InternalError;
    }

    const canCreateCGs = CGsWhitelist.includes(userAccessTokenPayload.address);

    const isStaff = !!(
      isAddressAStaffMember(userAccessTokenPayload.address) ||
      (userAccessTokenPayload.githubId && isGithubIdAStaffMember(userAccessTokenPayload.githubId))
    );

    return {
      canCreateCGs,
      isStaff,
    };
  }
}
