import { buildSchema, NonEmptyArray } from 'type-graphql';
import {
  /* Auto-generated Relation Resolvers */
  UserRelationsResolver,
  ProfileRelationsResolver,
  OrganizationRelationsResolver,
  RepoRelationsResolver,
  ClaimRelationsResolver,
  GitPOAPRelationsResolver,
  FeaturedPOAPRelationsResolver,
  /* Auto-generated CRUD Resolvers */
  UserCrudResolver,
  ProfileCrudResolver,
  OrganizationCrudResolver,
  RepoCrudResolver,
  ClaimCrudResolver,
  GitPOAPCrudResolver,
  FeaturedPOAPCrudResolver,
} from '@generated/type-graphql';
import { CustomClaimResolver } from './resolvers/claims';
import { CustomGitPOAPResolver } from './resolvers/gitpoaps';
import { CustomProfileResolver } from './resolvers/profiles';
import { CustomRepoResolver } from './resolvers/repos';
import { CustomSearchResolver } from './resolvers/search';

const allResolvers: NonEmptyArray<Function> = [
  // Generated resolvers
  // (Don't export generated Crud resolvers for now) - Temporarily enabling CRUD resolvers for DB introspection
  UserRelationsResolver,
  ProfileRelationsResolver,
  OrganizationRelationsResolver,
  RepoRelationsResolver,
  ClaimRelationsResolver,
  GitPOAPRelationsResolver,
  FeaturedPOAPRelationsResolver,
  // CRUD resolvers
  UserCrudResolver,
  ProfileCrudResolver,
  OrganizationCrudResolver,
  RepoCrudResolver,
  ClaimCrudResolver,
  GitPOAPCrudResolver,
  FeaturedPOAPCrudResolver,
  // Custom resolvers
  CustomClaimResolver,
  CustomGitPOAPResolver,
  CustomProfileResolver,
  CustomRepoResolver,
  CustomSearchResolver,
];

export const getSchema = buildSchema({
  resolvers: allResolvers,
  emitSchemaFile: true,
  validate: false,
});
