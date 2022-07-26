import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { ClaimStatus, FeaturedPOAP, Profile } from '@generated/type-graphql';
import { Context } from '../../context';
import { resolveENS, resolveAddress } from '../../external/ens';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';
import { getLastMonthStartDatetime } from './util';

@ObjectType()
class NullableProfile {
  @Field(() => Number, { nullable: true })
  id: number | null;

  @Field()
  address: string;

  @Field(() => String, { nullable: true })
  ensName: string | null;

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
  githubHandle: string | null;

  @Field(() => String, { nullable: true })
  twitterHandle: string | null;

  @Field(() => String, { nullable: true })
  personalSiteUrl: string | null;

  @Field(() => Boolean)
  leaderboardVisible: boolean;

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
  @Query(returns => Number)
  async totalContributors(@Ctx() { prisma }: Context): Promise<Number> {
    const logger = createScopedLogger('GQL totalContributors');

    logger.info('Request for total contributors');

    const endTimer = gqlRequestDurationSeconds.startTimer('totalContributors');

    const result: { count: number }[] = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT c.address)
      FROM "Claim" AS c
      WHERE c.address IS NOT NULL
        AND c.status = ${ClaimStatus.CLAIMED}
    `;

    logger.debug('Completed request for total contributors');

    endTimer({ success: 1 });

    return result[0].count;
  }

  @Query(returns => Number)
  async lastMonthContributors(@Ctx() { prisma }: Context): Promise<Number> {
    const logger = createScopedLogger('GQL lastMonthContributors');

    logger.info("Request for last month's contributors");

    const endTimer = gqlRequestDurationSeconds.startTimer('lastMonthContributors');

    const result: { count: number }[] = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT c.address)
      FROM "Claim" AS c
      WHERE c.address IS NOT NULL
        AND c.status = ${ClaimStatus.CLAIMED}
        AND c."mintedAt" > ${getLastMonthStartDatetime()}
    `;

    logger.debug("Completed request for last month's contributors");

    endTimer({ success: 1 });

    return result[0].count;
  }

  @Query(returns => NullableProfile, { nullable: true })
  async profileData(
    @Ctx() { prisma }: Context,
    @Arg('address') addressOrEns: string,
  ): Promise<NullableProfile | null> {
    const logger = createScopedLogger('GQL profileData');

    logger.info(`Request data for address: ${addressOrEns}`);

    const endTimer = gqlRequestDurationSeconds.startTimer('profileData');

    // Resolve ENS if provided
    const resolvedAddress = await resolveENS(addressOrEns);
    if (resolvedAddress === null) {
      endTimer({ success: 0 });
      return null;
    }

    let result = await prisma.profile.findUnique({
      where: {
        address: resolvedAddress.toLowerCase(),
      },
      include: {
        featuredPOAPs: true,
      },
    });

    /*
     * Saves us from having to resolve the ENS name from an address again ~ it's implied
     * that the ENS name was successfully resolved earlier.
     */
    const ensName = addressOrEns.endsWith('.eth')
      ? addressOrEns
      : await resolveAddress(resolvedAddress);

    if (result === null) {
      logger.debug(`Profile for ${addressOrEns} not created yet, returning blank profile.`);
      endTimer({ success: 1 });

      return {
        id: null,
        address: resolvedAddress,
        ensName: ensName,
        createdAt: null,
        updatedAt: null,
        bio: null,
        bannerImageUrl: null,
        name: null,
        profileImageUrl: null,
        githubHandle: null,
        twitterHandle: null,
        personalSiteUrl: null,
        leaderboardVisible: true,
        featuredPOAPs: [],
      };
    }

    const resultWithEns: NullableProfile = {
      ...result,
      ensName,
    };

    logger.debug(`Completed request for profile data for address: ${addressOrEns}`);
    endTimer({ success: 1 });

    return resultWithEns;
  }

  @Query(returns => [ProfileWithClaimsCount])
  async mostHonoredContributors(
    @Ctx() { prisma }: Context,
    @Arg('count', { defaultValue: 10 }) count: Number,
  ): Promise<ProfileWithClaimsCount[]> {
    const logger = createScopedLogger('GQL mostHonoredContributors');

    logger.info(`Request for ${count} most honored contributors`);

    const endTimer = gqlRequestDurationSeconds.startTimer('mostHonoredContributors');

    type ResultType = Profile & {
      claimsCount: Number;
    };

    const results: ResultType[] = await prisma.$queryRaw`
      SELECT p.*, COUNT(c.id) AS "claimsCount"
      FROM "Profile" AS p
      JOIN "Claim" AS c ON c.address = p.address
      WHERE c.status = ${ClaimStatus.CLAIMED}
      AND p."leaderboardVisible" = true
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

    endTimer({ success: 1 });

    return finalResults;
  }

  @Query(returns => [ProfileWithClaimsCount])
  async repoMostHonoredContributors(
    @Ctx() { prisma }: Context,
    @Arg('count', { defaultValue: 10 }) count: Number,
    @Arg('repoId') repoId: number,
  ): Promise<ProfileWithClaimsCount[]> {
    const logger = createScopedLogger('GQL repoMostHonoredContributors');

    logger.info(`Request for repo ${repoId}'s ${count} most honored contributors `);

    const endTimer = gqlRequestDurationSeconds.startTimer('repoMostHonoredContributors');

    type ResultType = Profile & {
      claimsCount: Number;
    };

    const results: ResultType[] = await prisma.$queryRaw`
      SELECT pf.*, COUNT(c.id) AS "claimsCount"
      FROM "Profile" AS pf
      INNER JOIN "Claim" AS c ON c.address = pf.address
      INNER JOIN "GitPOAP" AS gp ON gp.id = c."gitPOAPId"
      INNER JOIN "Project" AS pr ON pr.id = gp."projectId"
      INNER JOIN "Repo" AS r ON r."projectId" = pr.id
      WHERE c.status = ${ClaimStatus.CLAIMED} AND r.id = ${repoId}
      AND pf."leaderboardVisible" = true
      GROUP BY pf.id
      ORDER BY "claimsCount" DESC
      LIMIT ${count}
    `;

    let finalResults = [];

    for (const result of results) {
      const { claimsCount, ...profile } = result;

      finalResults.push({ profile, claimsCount });
    }

    logger.debug(`Completed request for repo ${repoId}'s ${count} most honored contributors`);

    endTimer({ success: 1 });

    return finalResults;
  }
}
