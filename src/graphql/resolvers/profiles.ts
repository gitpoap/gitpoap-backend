import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { ClaimStatus, FeaturedPOAP, Profile } from '@generated/type-graphql';
import { AuthLoggingContext } from '../middleware';
import { resolveAddressInternal } from '../../external/ens';
import { resolveENS, resolveENSAvatar } from '../../lib/ens';
import { getLastMonthStartDatetime } from './util';
import { upsertProfile } from '../../lib/profiles';

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
  claimsCount: number;
}

@Resolver(() => Profile)
export class CustomProfileResolver {
  @Query(() => Number)
  async totalContributors(@Ctx() { prisma, logger }: AuthLoggingContext): Promise<number> {
    logger.info('Request for total contributors');

    const result: { count: number }[] = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT c."mintedAddressId")::INTEGER
      FROM "Claim" AS c
      WHERE c."mintedAddressId" IS NOT NULL
        AND c.status = ${ClaimStatus.CLAIMED}::"ClaimStatus"
    `;

    return result[0].count;
  }

  @Query(() => Number)
  async lastMonthContributors(@Ctx() { prisma, logger }: AuthLoggingContext): Promise<number> {
    logger.info("Request for last month's contributors");

    const result: { count: number }[] = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT c."mintedAddressId")::INTEGER
      FROM "Claim" AS c
      WHERE c."mintedAddressId" IS NOT NULL
        AND c.status = ${ClaimStatus.CLAIMED}::"ClaimStatus"
        AND c."mintedAt" > ${getLastMonthStartDatetime()}
    `;

    return result[0].count;
  }

  @Query(() => NullableProfile, { nullable: true })
  async profileData(
    @Ctx() { prisma, logger }: AuthLoggingContext,
    @Arg('address') addressOrEns: string,
  ): Promise<NullableProfile | null> {
    logger.info(`Request Profile data for address: ${addressOrEns}`);

    // Resolve ENS if provided
    const resolvedAddress = await resolveENS(addressOrEns);
    if (resolvedAddress === null) {
      return null;
    }

    let result = await prisma.profile.findFirst({
      where: {
        address: { ethAddress: resolvedAddress.toLowerCase() },
      },
      include: {
        featuredPOAPs: true,
        address: {
          select: {
            ensName: true,
            ensAvatarImageUrl: true,
            githubUser: {
              select: { githubHandle: true },
            },
          },
        },
      },
    });

    if (result === null) {
      logger.debug(`Profile for ${addressOrEns} not created yet, creating a new profile.`);

      const ensName = addressOrEns.endsWith('.eth')
        ? addressOrEns
        : await resolveAddressInternal(resolvedAddress);

      const newProfile = await upsertProfile(resolvedAddress, ensName);

      if (newProfile === null) {
        logger.error(`Failed to upsert Profile for address ${resolvedAddress}`);

        const resultWithEns: NullableProfile = {
          id: null,
          address: resolvedAddress,
          ensName,
          createdAt: null,
          updatedAt: null,
          bio: null,
          bannerImageUrl: null,
          name: null,
          profileImageUrl: null,
          twitterHandle: null,
          githubHandle: null,
          personalSiteUrl: null,
          isVisibleOnLeaderboard: true,
          ensAvatarImageUrl: null,
          featuredPOAPs: [],
        };

        return resultWithEns;
      }

      result = {
        ...newProfile,
        featuredPOAPs: [],
      };

      if (ensName !== null) {
        // Resolve avatar in background
        void resolveENSAvatar(ensName, resolvedAddress);
      }
    }

    return {
      ...result,
      address: resolvedAddress,
      ensName: result.address.ensName,
      ensAvatarImageUrl: result.address.ensAvatarImageUrl,
      githubHandle: result.address.githubUser?.githubHandle ?? result.githubHandle,
    };
  }

  @Query(() => [ProfileWithClaimsCount])
  async mostHonoredContributors(
    @Ctx() { prisma, logger }: AuthLoggingContext,
    @Arg('count', { defaultValue: 10 }) count: number,
  ): Promise<ProfileWithClaimsCount[]> {
    logger.info(`Request for ${count} most honored contributors`);

    type ResultType = Profile & {
      claimsCount: number;
    };

    const results: ResultType[] = await prisma.$queryRaw`
      SELECT p.*, COUNT(c.id)::INTEGER AS "claimsCount"
      FROM "Profile" AS p
      INNER JOIN "Claim" AS c ON c."mintedAddressId" = p."addressId"
        AND c.status = ${ClaimStatus.CLAIMED}::"ClaimStatus"
      WHERE p."isVisibleOnLeaderboard" IS TRUE
      GROUP BY p.id
      ORDER BY "claimsCount" DESC
      LIMIT ${count}
    `;

    const finalResults = [];

    for (const result of results) {
      const { claimsCount, ...profile } = result;

      finalResults.push({ profile, claimsCount });
    }

    return finalResults;
  }

  @Query(() => [ProfileWithClaimsCount], { nullable: true })
  async repoMostHonoredContributors(
    @Ctx() { prisma, logger }: AuthLoggingContext,
    @Arg('repoId') repoId: number,
    @Arg('perPage', { defaultValue: 6 }) perPage?: number,
    @Arg('page', { defaultValue: 1 }) page?: number,
  ): Promise<ProfileWithClaimsCount[]> {
    logger.info(
      `Request for repo ${repoId}'s most honored contributors, with ${perPage} results per page and page ${page}`,
    );

    type ResultType = Profile & {
      claimsCount: number;
    };

    const results: ResultType[] = await prisma.$queryRaw`
      SELECT pf.*, COUNT(c.id)::INTEGER AS "claimsCount"
      FROM "Profile" AS pf
      INNER JOIN "Claim" AS c ON c."mintedAddressId" = pf."addressId"
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

    const finalResults = [];

    for (const result of results) {
      const { claimsCount, ...profile } = result;

      finalResults.push({ profile, claimsCount });
    }

    return finalResults;
  }
}
