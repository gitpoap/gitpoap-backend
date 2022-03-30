import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { ClaimStatus, FeaturedPOAP, Profile } from '@generated/type-graphql';
import { Context } from '../../context';
import { resolveENS } from '../../external/ens';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';

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

@ObjectType()
class ProfileWithClaimsCount {
  @Field(() => Profile)
  profile: Profile;

  @Field()
  claimsCount: Number;
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

    const endRequest = gqlRequestDurationSeconds.startTimer();

    // Resolve ENS if provided
    const resolvedAddress = await resolveENS(address);
    if (resolvedAddress === null) {
      endRequest({ request: 'profileData', success: 0 });
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

    endRequest({ request: 'profileData', success: 1 });

    return result;
  }

  @Query(returns => [ProfileWithClaimsCount])
  async mostHonoredContributors(
    @Ctx() { prisma }: Context,
    @Arg('count', { defaultValue: 10 }) count: Number,
  ): Promise<ProfileWithClaimsCount[]> {
    const logger = createScopedLogger('GQL mostHonoredContributors');

    logger.info(`Request for ${count} most honored contributors`);

    const endRequest = gqlRequestDurationSeconds.startTimer();

    type ResultType = Profile & {
      claimsCount: Number;
    };

    const results: ResultType[] = await prisma.$queryRaw`
      SELECT p.*, COUNT(c.id) AS "claimsCount"
      FROM "Profile" AS p
      JOIN "Claim" AS c ON c.address = p.address
      WHERE c.status = ${ClaimStatus.CLAIMED}
      GROUP BY p.id
      ORDER BY "claimsCount" DESC
      LIMIT ${count}
    `;

    let finalResults = [];

    for (const result of results) {
      const { claimsCount, ...profile } = result;

      finalResults.push({ profile, claimsCount });
    }

    logger.debug(`Completed request for ${count} most honored contributors`);

    endRequest({ request: 'mostHonoredContributors', success: 1 });

    return finalResults;
  }
}
