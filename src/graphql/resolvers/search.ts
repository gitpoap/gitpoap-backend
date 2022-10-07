import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Profile as ProfileValue, User as UserValue } from '@generated/type-graphql';
import { createScopedLogger } from '../../logging';
import { gqlRequestDurationSeconds } from '../../metrics';
import { resolveENS } from '../../lib/ens';
import { Context, context } from '../../context';
import { Profile, User } from '@prisma/client';

@ObjectType()
class SearchResults {
  @Field(() => [UserValue])
  users: User[];

  @Field(() => [ProfileValue])
  profiles: Profile[];
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
        users: [],
        profiles: [],
      };
    }

    const matchText = `%${text}%`;

    const users = await prisma.user.findMany({
      where: {
        githubHandle: {
          contains: matchText,
          mode: 'insensitive',
        },
      },
    });

    let profiles = await prisma.profile.findMany({
      distinct: ['id'],
      where: {
        OR: [
          {
            address: {
              ensName: {
                contains: matchText,
                mode: 'insensitive',
              },
            },
          },
          {
            name: {
              contains: matchText,
              mode: 'insensitive',
            },
          },
          {
            address: {
              ethAddress: {
                contains: matchText,
                mode: 'insensitive',
              },
            },
          },
        ],
      },
    });

    // Save the profile if we've never seen it before
    if (profiles.length === 0 && text.endsWith('.eth')) {
      const address = await resolveENS(text, { synchronous: true });

      // If we just found a resolution, return the profile
      if (address !== null) {
        const profile = await context.prisma.profile.findFirst({
          where: {
            address: {
              ethAddress: address.toLowerCase(),
            },
          },
        });

        if (profile === null) {
          logger.error(`ENS name "${text}" resolved to ${address} but no Profile was created`);
        } else {
          profiles = [profile];
        }
      }
    }

    logger.debug(`Completed request to search for "${text}"`);

    endTimer({ success: 1 });

    return {
      users,
      profiles,
    };
  }
}
