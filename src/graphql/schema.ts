import { buildSchema, NonEmptyArray } from 'type-graphql';
import { resolvers } from '@generated/type-graphql';
import { CustomClaimResolver } from './resolvers/claims';
import { CustomGitPOAPResolver } from './resolvers/gitpoaps';
import { CustomRepoResolver } from './resolvers/repos';
import { CustomUserResolver } from './resolvers/users';

const allResolvers: NonEmptyArray<Function> = [
  ...resolvers,
  CustomClaimResolver,
  CustomGitPOAPResolver,
  CustomRepoResolver,
  CustomUserResolver,
];

export const getSchema = buildSchema({
  resolvers: allResolvers,
  emitSchemaFile: true,
  validate: false,
});
