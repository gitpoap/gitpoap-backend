import { Arg, buildSchema, Ctx, Resolver, Query } from 'type-graphql';
import { resolvers, User } from '@generated/type-graphql';

console.log(resolvers)

@Resolver(of => User)
class CustomResolver {
  @Query(returns => [User])
  async topContributors(
    @Ctx() { prisma }: Context,
    @Arg("count", { defaultValue: 10 }) count: number,
  ): Promise<User[]> {
    let users = await prisma.users.findMany();
    return users;
  }
};
console.log([...resolvers, CustomResolver])

export const getSchema = buildSchema({
  resolvers: [...resolvers, CustomResolver],
  emitSchemaFile: true,
  validate: false,
});
