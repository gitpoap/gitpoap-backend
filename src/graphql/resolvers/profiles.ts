import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { ClaimStatus, FeaturedPOAP, Profile } from '@generated/type-graphql';
import { Context } from '../../context';
import { resolveENS, resolveAddress } from '../../lib/ens';
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
  isVisibleOnLeaderboard: boolean;

  @Field(() => String, { nullable: true })
  ensAvatarImageUrl: string | null;

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
      SELECT COUNT(DISTINCT c.address)::INTEGER
      FROM "Claim" AS c
      WHERE c.address IS NOT NULL
        AND c.status = ${ClaimStatus.CLAIMED}::"ClaimStatus"
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
      SELECT COUNT(DISTINCT c.address)::INTEGER
      FROM "Claim" AS c
      WHERE c.address IS NOT NULL
        AND c.status = ${ClaimStatus.CLAIMED}::"ClaimStatus"
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
        isVisibleOnLeaderboard: true,
        ensAvatarImageUrl: null,
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
      SELECT p.*, COUNT(c.id)::INTEGER AS "claimsCount"
      FROM "Profile" AS p
      INNER JOIN "Claim" AS c ON c.address = p.address
        AND c.status = ${ClaimStatus.CLAIMED}::"ClaimStatus"
      WHERE p."isVisibleOnLeaderboard" IS TRUE
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

  @Query(returns => [ProfileWithClaimsCount], { nullable: true })
  async repoMostHonoredContributors(
    @Ctx() { prisma }: Context,
    @Arg('repoId') repoId: number,
    @Arg('perPage', { defaultValue: 6 }) perPage?: number,
    @Arg('page', { defaultValue: 1 }) page?: number,
  ): Promise<ProfileWithClaimsCount[]> {
    const logger = createScopedLogger('GQL repoMostHonoredContributors');

    logger.info(
      `Request for repo ${repoId}'s most honored contributors, with ${perPage} results per page and page ${page}`,
    );

    const endTimer = gqlRequestDurationSeconds.startTimer('repoMostHonoredContributors');

    type ResultType = Profile & {
      claimsCount: Number;
    };

    const results: ResultType[] = await prisma.$queryRaw`
      SELECT pf.*, COUNT(c.id)::INTEGER AS "claimsCount"
      FROM "Profile" AS pf
      INNER JOIN "Claim" AS c ON c.address = pf.address
        AND c.status = ${ClaimStatus.CLAIMED}::"ClaimStatus"
      INNER JOIN "GitPOAP" AS gp ON gp.id = c."gitPOAPId"
      INNER JOIN "Project" AS pr ON pr.id = gp."projectId"
      INNER JOIN "Repo" AS r ON r."projectId" = pr.id
        AND r.id = ${repoId}
      WHERE pf."isVisibleOnLeaderboard" IS TRUE
      GROUP BY pf.id
      ORDER BY "claimsCount" DESC
      LIMIT ${<number>perPage} OFFSET ${(<number>page - 1) * <number>perPage}
    `;

    let finalResults = [];

    for (const result of results) {
      const { claimsCount, ...profile } = result;

      finalResults.push({ profile, claimsCount });
    }

    logger.debug(
      `Completed request for repo ${repoId}'s most honored contributors, with ${perPage} results per page and page ${page}`,
    );

    endTimer({ success: 1 });

    return finalResults;
  }
}
