import { Ctx, Field, ObjectType, Resolver, Query, Authorized } from 'type-graphql';
import { AuthRoles } from '../auth';
import { InternalError } from '../errors';
import { AuthLoggingContext } from '../middleware';
import { isAddressAStaffMember, isGithubIdAStaffMember } from '../../lib/staff';

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
    @Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext,
  ): Promise<Permissions> {
    logger.info("Request for logged-in user's permissions");

    if (userAccessTokenPayload === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      throw InternalError;
    }

    const userCreatedGitPOAP = await prisma.gitPOAP.findFirst({
      where: {
        OR: [
          { creatorAddressId: userAccessTokenPayload.addressId },
          { creatorEmailId: userAccessTokenPayload.emailId },
        ],
      },
    });
    // If the user has created a GitPOAP, they can submit new CG requests
    const canCreateCGs = !!userCreatedGitPOAP;

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
