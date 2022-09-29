import { Email } from '@generated/type-graphql';
import { Arg, Ctx, Resolver, Query } from 'type-graphql';

import { Context } from '../../context';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';

@Resolver(of => Email)
export class CustomEmailResolver {
  @Query(returns => Email, { nullable: true })
  async userEmail(
    @Ctx() { prisma }: Context,
    @Arg('addressId') addressId: number,
  ): Promise<Email | null> {
    const logger = createScopedLogger('GQL userEmail');

    logger.info(`Request for the email of address: ${addressId}`);

    const endTimer = gqlRequestDurationSeconds.startTimer('userEmail');

    const email = await prisma.email.findUnique({
      where: {
        addressId: addressId,
      },
    });

    logger.debug(`Completed request for the email of address: ${addressId}`);

    endTimer({ success: 1 });

    return email;
  }
}
