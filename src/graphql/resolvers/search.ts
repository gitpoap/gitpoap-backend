import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Profile, User } from '@generated/type-graphql';
import { Context } from '../../context';
import { resolveENS } from '../../external/ens';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';
import { Prisma } from '@prisma/client';

@ObjectType()
class ProfileWithENS {
  @Field(() => Profile)
  profile: Profile;

  @Field()
  ens: string;
}

/* Search V1 */
@ObjectType()
class SearchResults {
  @Field(() => [User])
  usersByGithubHandle: User[];

  @Field(() => [Profile])
  profilesByName: Profile[];

  @Field(() => [Profile])
  profilesByAddress: Profile[];

  @Field(() => ProfileWithENS, { nullable: true })
  profileByENS: ProfileWithENS | null;
}

/* Search V2 */
@ObjectType()
class SearchResultItem {
  @Field()
  id: string;
  @Field()
  text: string;
  @Field()
  type: 'org' | 'profile' | 'repo';
  @Field({ nullable: true })
  href: string;
  @Field({ nullable: true })
  score: string;
}

@ObjectType()
class SearchResultsV2 {
  @Field(() => [SearchResultItem])
  results: SearchResultItem[];
  @Field()
  total: number;
}

@Resolver()
export class CustomSearchResolver {
  @Query(returns => SearchResults)
  async search(@Ctx() { prisma }: Context, @Arg('text') text: string): Promise<SearchResults> {
    const logger = createScopedLogger('GQL search');

    logger.info(`Request to search for "${text}"`);

    const endTimer = gqlRequestDurationSeconds.startTimer('search');

    if (text.length < 2) {
      logger.info('Skipping search for single character');
      endTimer({ success: 1 });
      return {
        usersByGithubHandle: [],
        profilesByName: [],
        profilesByAddress: [],
        profileByENS: null,
      };
    }

    const matchText = `%${text}%`;
    const usersByGithubHandle = await prisma.$queryRaw<User[]>`
      SELECT * FROM "User"
      WHERE "githubHandle" ILIKE ${matchText}
    `;

    const profilesByName = await prisma.$queryRaw<Profile[]>`
      SELECT * FROM "Profile"
      WHERE name ILIKE ${matchText}
    `;

    const profilesByAddress = await prisma.$queryRaw<Profile[]>`
      SELECT * FROM "Profile"
      WHERE address ILIKE ${matchText}
    `;

    let profileByENS = null;
    const resolvedAddress = await resolveENS(text);
    if (resolvedAddress !== text && resolvedAddress !== null) {
      const result = await prisma.profile.findUnique({
        where: {
          address: resolvedAddress.toLowerCase(),
        },
      });
      if (result !== null) {
        profileByENS = {
          profile: result,
          ens: text,
        };
      }
    }

    logger.debug(`Completed request to search for "${text}"`);

    endTimer({ success: 1 });

    return {
      usersByGithubHandle,
      profilesByName,
      profilesByAddress,
      profileByENS,
    };
  }

  @Query(returns => SearchResultsV2)
  async searchv2(@Ctx() { prisma }: Context, @Arg('text') text: string): Promise<SearchResultsV2> {
    const logger = createScopedLogger('GQL search');
    logger.info(`Request to search for "${text}"`);
    const endTimer = gqlRequestDurationSeconds.startTimer('search');

    const matchText = `%${text}%`;
    const limit = 2;
    const offset = 0;

    const rawRecordsQuery = Prisma.sql`
        SELECT
          "Organization"."id",
          "Organization"."name" AS text,
          CONCAT('/gh/', "Organization"."name") AS href,
          'org' AS type,
          levenshtein("Organization"."name", ${matchText}) AS score
          FROM "Organization"
            WHERE "Organization"."name" ILIKE ${matchText}
          UNION
        SELECT
          "Repo"."id",
          "Repo"."name" AS text,
          CONCAT('/gh/', "Organization"."name", '/', "Repo"."name") AS href,
          'repo' AS type,
          levenshtein("Repo"."name", ${matchText}) AS score
          FROM "Repo" JOIN "Organization" ON "Repo"."organizationId" = "Organization"."id"
            WHERE "Repo"."name" ILIKE ${matchText}
          UNION
        SELECT
          "Profile"."id",
          "Profile"."address" AS text,
          CONCAT('/p/', "Profile"."address") AS href,
          'profile' AS type,
          levenshtein("Profile"."address", ${matchText}) AS score
          FROM "Profile"
            WHERE "address" ILIKE ${matchText}
    `;

    const query = Prisma.sql`
      with raw_records as (
        ${rawRecordsQuery}
      )
      SELECT *, COUNT(*) OVER() AS total_count
        FROM raw_records
        ORDER BY score ASC
        LIMIT ${limit}
        OFFSET ${offset}
    `;

    const totalCountQuery = Prisma.sql`
      with raw_records as (
        ${rawRecordsQuery}
      )
      SELECT COUNT(*)
        FROM raw_records
    `;

    const results = await prisma.$queryRaw<SearchResultItem[]>(Prisma.sql`${query}`);
    const total = await prisma.$queryRaw<[{ count: number }]>(Prisma.sql`${totalCountQuery}`);

    logger.debug(`Completed request to search for "${text}"`);
    endTimer({ success: 1 });
    return {
      results,
      total: total[0].count,
    };
  }
}
