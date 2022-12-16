import { Authorized, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Email } from '@generated/type-graphql';
import { AuthRoles } from '../auth';
import { AuthLoggingContext } from '../middleware';

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
  @Query(() => UserEmail)
  async userEmail(@Ctx() { prisma, userAccessTokenPayload, logger }: AuthLoggingContext) {
    logger.info("Request for logged-in user's email");

    if (userAccessTokenPayload === null) {
      logger.error('Route passed AuthRoles.Address authorization without user payload set');
      throw new Error('Internal server error');
    }

    const emailData = await prisma.email.findUnique({
      where: { addressId: userAccessTokenPayload.addressId },
      select: {
        emailAddress: true,
        isValidated: true,
      },
    });

    return {
      emailAddress: emailData?.emailAddress ?? null,
      isValidated: emailData?.isValidated ?? false,
    };
  }
}
