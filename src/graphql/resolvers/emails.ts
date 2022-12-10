import { Authorized, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Email } from '@generated/type-graphql';
import { AuthContext, AuthRoles } from '../auth';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';

@ObjectType()
class UserEmail {
  @Field(() => String, { nullable: true })
  emailAddress: string | null;

  @Field(() => Boolean)
  isValidated: boolean;
}

@Resolver(() => Email)
export class CustomEmailResolver {
  @Authorized(AuthRoles.Address)
  @Query(() => UserEmail, { nullable: true })
  async userEmail(@Ctx() { prisma, userAccessTokenPayload }: AuthContext) {
    const logger = createScopedLogger('GQL userEmail');

    logger.info("Request for user's email address");

    const endTimer = gqlRequestDurationSeconds.startTimer('lastMonthContributors');

    if (userAccessTokenPayload === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      endTimer({ success: 0 });
      return null;
    }

    const emailData = await prisma.email.findUnique({
      where: { addressId: userAccessTokenPayload.addressId },
      select: {
        emailAddress: true,
        isValidated: true,
      },
    });

    endTimer({ success: 1 });

    logger.debug("Completed request for user's email address");

    return {
      emailAddress: emailData?.emailAddress ?? null,
      isValidated: emailData?.isValidated ?? false,
    };
  }
}
