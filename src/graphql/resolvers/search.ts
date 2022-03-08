import { Arg, Ctx, Field, ObjectType, Resolver, Query } from 'type-graphql';
import { Profile, User } from '@generated/type-graphql';
import { Context } from '../../context';

@ObjectType()
class SearchResults {
  @Field(() => [User])
  usersByGithubHandle: User[];

  @Field(() => [Profile])
  profilesByName: Profile[];

  @Field(() => [Profile])
  profilesByAddress: Profile[];
}

@Resolver()
export class CustomSearchResolver {
  @Query(returns => SearchResults)
  async search(@Ctx() { prisma }: Context, @Arg('text') text: string): Promise<SearchResults> {
    const matchText = `%${text}%`;
    const usersByGithubHandle = await prisma.$queryRaw`
      SELECT * FROM "User"
      WHERE "githubHandle" ILIKE ${matchText}
    `;
    console.log(usersByGithubHandle);

    const profilesByName = await prisma.$queryRaw`
      SELECT * FROM "Profile"
      WHERE name ILIKE ${matchText}
    `;
    console.log(profilesByName);

    const profilesByAddress = await prisma.$queryRaw`
      SELECT * FROM "Profile"
      WHERE address ILIKE ${matchText}
    `;
    console.log(profilesByAddress);

    return {
      usersByGithubHandle,
      profilesByName,
      profilesByAddress,
    };
  }
}
