import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { FeaturedPOAP, Profile } from '@generated/type-graphql';
import { Context } from '../../context';
import { resolveENS } from '../../external/ens';
import { createScopedLogger } from '../../logging';

@ObjectType()
class NullableProfile {
  @Field(() => Number, { nullable: true })
  id: number | null;

  @Field()
  address: string;

  @Field(() => Date, { nullable: true })
  createdAt: Date | null;

  @Field(() => Date, { nullable: true })
  updatedAt: Date | null;

  @Field(() => String, { nullable: true })
  bio: string | null;

  @Field(() => String, { nullable: true })
  bannerImageUrl: string | null;

  @Field(() => String, { nullable: true })
  name: string | null;

  @Field(() => String, { nullable: true })
  profileImageUrl: string | null;

  @Field(() => String, { nullable: true })
  twitterHandle: string | null;

  @Field(() => String, { nullable: true })
  personalSiteUrl: string | null;

  @Field(() => [FeaturedPOAP])
  featuredPOAPs: FeaturedPOAP[];
}

@Resolver(of => Profile)
export class CustomProfileResolver {
  @Query(returns => NullableProfile, { nullable: true })
  async profileData(
    @Ctx() { prisma }: Context,
    @Arg('address') address: string,
  ): Promise<NullableProfile | null> {
    const logger = createScopedLogger('GQL profileData');

    logger.info(`Request data for address: ${address}`);

    // Resolve ENS if provided
    const resolvedAddress = await resolveENS(address);
    if (resolvedAddress === null) {
      return null;
    }

    let result: NullableProfile | null = await prisma.profile.findUnique({
      where: {
        address: resolvedAddress.toLowerCase(),
      },
      include: {
        featuredPOAPs: true,
      },
    });

    if (result === null) {
      logger.debug(`Profile for ${address} not created yet, returning blank profile.`);

      result = {
        id: null,
        address: resolvedAddress,
        createdAt: null,
        updatedAt: null,
        bio: null,
        bannerImageUrl: null,
        name: null,
        profileImageUrl: null,
        twitterHandle: null,
        personalSiteUrl: null,
        featuredPOAPs: [],
      };
    }

    logger.debug(`Completed request data for address: ${address}`);

    return result;
  }
}
