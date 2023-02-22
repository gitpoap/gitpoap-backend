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

    if (userAccessTokenPayload === null || userAccessTokenPayload.address === null) {
      logger.error('Route passed AuthRoles.Address authorization without user/address payload set');
      throw InternalError;
    }

    logger.info(`Checking if ${userAccessTokenPayload.address} has permission to create CGs`);

    const canCreateCGs = CGsWhitelist.has(userAccessTokenPayload.address.ethAddress);

    logger.info(`${userAccessTokenPayload.address} can create CGs: ${canCreateCGs}`);

    const isStaff = !!(
      isAddressAStaffMember(userAccessTokenPayload.address.ethAddress) ||
      (userAccessTokenPayload.github &&
        isGithubIdAStaffMember(userAccessTokenPayload.github.githubId))
    );

    return {
      canCreateCGs,
      isStaff,
    };
  }
}
