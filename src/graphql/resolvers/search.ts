import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Profile, User } from '@generated/type-graphql';
import { Context } from '../../context';
import { resolveENS } from '../../external/ens';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';

@ObjectType()
class ProfileWithENS {
  @Field(() => Profile)
  profile: Profile;

  @Field()
  ens: string;
}

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
    const usersByGithubHandle = await prisma.user.findMany({
      where: {
        githubHandle: {
          contains: matchText,
          mode: 'insensitive',
        },
      },
    });

    const profilesByName = await prisma.profile.findMany({
      where: {
        name: {
          contains: matchText,
          mode: 'insensitive',
        },
      },
    });

    const profilesByAddress = await prisma.profile.findMany({
      where: {
        address: {
          contains: matchText,
          mode: 'insensitive',
        },
      },
    });

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
}
