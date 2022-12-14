import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Profile as ProfileValue, GithubUser as GithubUserValue } from '@generated/type-graphql';
import { resolveENS } from '../../lib/ens';
import { AuthLoggingContext } from '../middleware';
import { GithubUser, Profile } from '@prisma/client';

@ObjectType()
class SearchResults {
  @Field(() => [GithubUserValue])
  githubUsers: GithubUser[];

  @Field(() => [ProfileValue])
  profiles: Profile[];
}

@Resolver()
export class CustomSearchResolver {
  @Query(() => SearchResults)
  async search(
    @Ctx() { prisma, logger }: AuthLoggingContext,
    @Arg('text') text: string,
  ): Promise<SearchResults> {
    logger.info(`Request to search for "${text}"`);

    if (text.length < 2) {
      logger.info('Skipping search for less than two characters');
      return {
        githubUsers: [],
        profiles: [],
      };
    }

    const contains = `%${text}%`;
    const mode = 'insensitive';

    const githubUsers = await prisma.githubUser.findMany({
      where: {
        githubHandle: { contains, mode },
      },
    });

    let profiles = await prisma.profile.findMany({
      distinct: ['id'],
      where: {
        OR: [
          { address: { ensName: { contains, mode } } },
          { name: { contains, mode } },
          { address: { ethAddress: { contains, mode } } },
        ],
      },
    });

    // Save the profile if we've never seen it before
    if (profiles.length === 0 && text.endsWith('.eth')) {
      const address = await resolveENS(text, { synchronous: true });

      // If we just found a resolution, return the profile
      if (address !== null) {
        const profile = await prisma.profile.findFirst({
          where: {
            address: { ethAddress: address.toLowerCase() },
          },
        });

        if (profile === null) {
          logger.error(`ENS name "${text}" resolved to ${address} but no Profile was created`);
        } else {
          profiles = [profile];
        }
      }
    }

    return { githubUsers, profiles };
  }
}
