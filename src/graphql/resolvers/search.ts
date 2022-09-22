import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Profile, User } from '@generated/type-graphql';
import { Context } from '../../context';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';

@ObjectType()
class SearchResults {
  @Field(() => [User])
  usersByGithubHandle: User[];

  @Field(() => [Profile])
  profilesByName: Profile[];

  @Field(() => [Profile])
  profilesByAddress: Profile[];

  @Field(() => [Profile])
  profilesByENS: Profile[];
}

@Resolver()
export class CustomSearchResolver {
  @Query(returns => SearchResults)
  async search(@Ctx() { prisma }: Context, @Arg('text') text: string): Promise<SearchResults> {
    const logger = createScopedLogger('GQL search');

    logger.info(`Request to search for "${text}"`);

    const endTimer = gqlRequestDurationSeconds.startTimer('search');

    if (text.length < 2) {
      logger.info('Skipping search for less than two characters');
      endTimer({ success: 1 });
      return {
        usersByGithubHandle: [],
        profilesByName: [],
        profilesByAddress: [],
        profilesByENS: [],
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
        oldAddress: {
          contains: matchText,
          mode: 'insensitive',
        },
      },
    });

    let profilesByENS = await prisma.profile.findMany({
      where: {
        oldEnsName: {
          contains: matchText,
          mode: 'insensitive',
        },
      },
    });

    logger.debug(`Completed request to search for "${text}"`);

    endTimer({ success: 1 });

    return {
      usersByGithubHandle,
      profilesByName,
      profilesByAddress,
      profilesByENS,
    };
  }
}
