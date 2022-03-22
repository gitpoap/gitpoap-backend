import { buildSchema, NonEmptyArray } from 'type-graphql';
import {
  UserRelationsResolver,
  ProfileRelationsResolver,
  OrganizationRelationsResolver,
  RepoRelationsResolver,
  ClaimRelationsResolver,
  GitPOAPRelationsResolver,
  FeaturedPOAPRelationsResolver,
} from '@generated/type-graphql';
import { CustomClaimResolver } from './resolvers/claims';
import { CustomGitPOAPResolver } from './resolvers/gitpoaps';
import { CustomProfileResolver } from './resolvers/profiles';
import { CustomRepoResolver } from './resolvers/repos';
import { CustomSearchResolver } from './resolvers/search';
import { CustomUserResolver } from './resolvers/users';

const allResolvers: NonEmptyArray<Function> = [
  // Generated resolvers
  // (Don't export generated Crud resolvers for now)
  UserRelationsResolver,
  ProfileRelationsResolver,
  OrganizationRelationsResolver,
  RepoRelationsResolver,
  ClaimRelationsResolver,
  GitPOAPRelationsResolver,
  FeaturedPOAPRelationsResolver,
  // Custom resolvers
  CustomClaimResolver,
  CustomGitPOAPResolver,
  CustomProfileResolver,
  CustomRepoResolver,
  CustomSearchResolver,
  CustomUserResolver,
];

export const getSchema = buildSchema({
  resolvers: allResolvers,
  emitSchemaFile: true,
  validate: false,
});
