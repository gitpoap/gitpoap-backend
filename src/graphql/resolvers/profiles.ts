import { Arg, Ctx, Resolver, Query } from 'type-graphql';
import { Profile } from '@generated/type-graphql';
import { Context } from '../../context';
import { resolveENS } from '../../util';
import { createScopedLogger } from '../../logging';

@Resolver(of => Profile)
export class CustomProfileResolver {
  @Query(returns => Profile, { nullable: true })
  async profileData(
    @Ctx() { prisma, provider }: Context,
    @Arg('address') address: string,
  ): Promise<Profile | null> {
    const logger = createScopedLogger('GQL profileData');

    logger.info(`Request data for address: ${address}`);

    // Resolve ENS if provided
    const resolvedAddress = await resolveENS(provider, address);
    if (resolvedAddress === null) {
      return null;
    }

    const result = await prisma.profile.findUnique({
      where: {
        address: resolvedAddress.toLowerCase(),
      },
    });

    logger.debug(`Completed request data for address: ${address}`);

    return result;
  }
}
