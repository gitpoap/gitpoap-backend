import { Arg, Ctx, Resolver, Query } from 'type-graphql';
import { Profile } from '@generated/type-graphql';
import { Context } from '../../context';
import { resolveENS } from '../../util';

@Resolver(of => Profile)
export class CustomProfileResolver {
  @Query(returns => Profile, { nullable: true })
  async profileData(
    @Ctx() { prisma, provider }: Context,
    @Arg('address') address: string,
  ): Promise<Profile | null> {
    // Resolve ENS if provided
    const resolvedAddress = await resolveENS(provider, address);
    if (resolvedAddress === null) {
      return null;
    }

    return await prisma.profile.findUnique({
      where: {
        address: resolvedAddress.toLowerCase(),
      },
    });
  }
}
