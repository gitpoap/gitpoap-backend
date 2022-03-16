import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Profile, User } from '@generated/type-graphql';
import { Context } from '../../context';
import { resolveENS } from '../../util';

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
  async search(
    @Ctx() { prisma, provider }: Context,
    @Arg('text') text: string,
  ): Promise<SearchResults> {
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
    const resolvedAddress = await resolveENS(provider, text);
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

    return {
      usersByGithubHandle,
      profilesByName,
      profilesByAddress,
      profileByENS,
    };
  }
}
