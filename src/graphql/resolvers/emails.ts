import { Email } from '@generated/type-graphql';
import { Arg, Ctx, Query, Resolver } from 'type-graphql';

import { Context } from '../../context';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';

type EmailResponse = Pick<Email, 'id' | 'emailAddress' | 'isValidated' | 'tokenExpiresAt'>;

@Resolver(of => Email)
export class CustomEmailResolver {
  @Query(returns => Email, { nullable: true })
  async userEmail(
    @Ctx() { prisma }: Context,
    @Arg('ethAddress') ethAddress: string,
  ): Promise<EmailResponse | null> {
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
