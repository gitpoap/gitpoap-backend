import { buildSchema, NonEmptyArray } from 'type-graphql';
/* Don't export generated resolvers for now */
import {
  UserCrudResolver,
  UserRelationsResolver,
  ProfileCrudResolver,
  ProfileRelationsResolver,
  OrganizationCrudResolver,
  OrganizationRelationsResolver,
  RepoCrudResolver,
  RepoRelationsResolver,
  ClaimCrudResolver,
  ClaimRelationsResolver,
  GitPOAPCrudResolver,
  GitPOAPRelationsResolver,
  FeaturedPOAPCrudResolver,
  FeaturedPOAPRelationsResolver,
} from '@generated/type-graphql';

import { CustomClaimResolver } from './resolvers/claims';
import { CustomGitPOAPResolver } from './resolvers/gitpoaps';
import { CustomProfileResolver } from './resolvers/profiles';
import { CustomRepoResolver } from './resolvers/repos';
import { CustomSearchResolver } from './resolvers/search';
import { CustomUserResolver } from './resolvers/users';

const allResolvers: NonEmptyArray<Function> = [
  /* Don't export generated resolvers for now */
  // Generated resolvers
  UserCrudResolver,
  UserRelationsResolver,
  ProfileCrudResolver,
  ProfileRelationsResolver,
  OrganizationCrudResolver,
  OrganizationRelationsResolver,
  RepoCrudResolver,
  RepoRelationsResolver,
  ClaimCrudResolver,
  ClaimRelationsResolver,
  GitPOAPCrudResolver,
  GitPOAPRelationsResolver,
  FeaturedPOAPCrudResolver,
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
