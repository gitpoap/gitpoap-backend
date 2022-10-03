import { Email } from '@generated/type-graphql';
import { Arg, Ctx, Field, ObjectType, Query, Resolver } from 'type-graphql';

import { Context } from '../../context';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';

@ObjectType()
class VerifyEmailResponse {
  @Field(() => Number)
  id: number;

  @Field(() => String)
  emailAddress: string;

  @Field(() => Boolean)
  isValidated: boolean;

  @Field(() => Date)
  tokenExpiresAt: Date;
}

@Resolver(of => Email)
export class CustomEmailResolver {
  @Query(returns => VerifyEmailResponse, { nullable: true })
  async userEmail(
    @Ctx() { prisma }: Context,
    @Arg('ethAddress') ethAddress: string,
  ): Promise<VerifyEmailResponse | null> {
    const logger = createScopedLogger('GQL userEmail');

    logger.info(`Request for the email of address: ${ethAddress}`);

    const endTimer = gqlRequestDurationSeconds.startTimer('userEmail');

    const email = await prisma.email.findFirst({
      where: {
        address: {
          ethAddress: ethAddress.toLowerCase(),
        },
      },
      select: {
        id: true,
        emailAddress: true,
        isValidated: true,
        tokenExpiresAt: true,
      },
    });

    logger.debug(`Completed request for the email of address: ${ethAddress}`);

    endTimer({ success: 1 });

    return email;
  }
}
