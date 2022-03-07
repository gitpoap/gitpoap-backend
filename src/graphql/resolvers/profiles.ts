import { Arg, Ctx, Resolver, Query } from 'type-graphql';
import { Profile } from '@generated/type-graphql';
import { Context } from '../../context';

@Resolver(of => Profile)
export class CustomProfileResolver {
  @Query(returns => Profile, { nullable: true })
  async profileData(
    @Ctx() { prisma, provider }: Context,
    @Arg('address') address: string,
  ): Promise<Profile | null> {
    // Resolve ENS if provided
    const resolvedAddress = await provider.resolveName(address);
    if (resolvedAddress !== address) {
      console.log(`Resolved ${address} to ${resolvedAddress}`);
      if (resolvedAddress === null) {
        return null;
      }
    }

    return await prisma.profile.findUnique({
      where: {
        address: resolvedAddress.toLowerCase(),
      },
    });
  }
}
