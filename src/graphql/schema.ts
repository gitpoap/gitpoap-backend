import { buildSchema } from 'type-graphql';
import { resolvers } from '@generated/type-graphql';
import { CustomUserResolver } from './resolvers/users';
import { CustomGitPOAPResolver } from './resolvers/gitpoaps';
import { CustomRepoResolver } from './resolvers/repos';

const allResolvers = [...resolvers, CustomUserResolver, CustomGitPOAPResolver, CustomRepoResolver];

export const getSchema = buildSchema({
  resolvers: allResolvers,
  emitSchemaFile: true,
  validate: false,
});
