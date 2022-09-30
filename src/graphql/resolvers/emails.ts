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
    @Arg('ethAddress') ethAddress: string,
  ): Promise<Email | null> {
    const logger = createScopedLogger('GQL userEmail');

    logger.info(`Request for the email of address: ${ethAddress}`);

    const endTimer = gqlRequestDurationSeconds.startTimer('userEmail');

    const email = await prisma.email.findFirst({
      where: {
        address: {
          ethAddress,
        },
      },
    });

    logger.debug(`Completed request for the email of address: ${ethAddress}`);

    endTimer({ success: 1 });

    return email;
  }
}
