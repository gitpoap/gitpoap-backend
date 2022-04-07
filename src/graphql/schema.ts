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
  /* Auto-generated GitPOAP Resolvers */
  FindUniqueGitPOAPResolver,
  FindFirstGitPOAPResolver,
  FindManyGitPOAPResolver,
  /* Auto-generated User Resolvers */
  FindUniqueUserResolver,
  FindFirstUserResolver,
  FindManyUserResolver,
  /* Auto-generated Profile Resolvers */
  FindUniqueProfileResolver,
  FindFirstProfileResolver,
  FindManyProfileResolver,
  /* Auto-generated Organization Resolvers */
  FindUniqueOrganizationResolver,
  FindFirstOrganizationResolver,
  FindManyOrganizationResolver,
  /* Auto-generated Repo Resolvers */
  FindUniqueRepoResolver,
  FindFirstRepoResolver,
  FindManyRepoResolver,
  /* Auto-generated Claim Resolvers */
  FindUniqueClaimResolver,
  FindFirstClaimResolver,
  FindManyClaimResolver,
  /* Auto-generated FeaturedPOAP Resolvers */
  FindUniqueFeaturedPOAPResolver,
  FindFirstFeaturedPOAPResolver,
  FindManyFeaturedPOAPResolver,
} from '@generated/type-graphql';
import { CustomClaimResolver } from './resolvers/claims';
import { CustomGitPOAPResolver } from './resolvers/gitpoaps';
import { CustomProfileResolver } from './resolvers/profiles';
import { CustomRepoResolver } from './resolvers/repos';
import { CustomSearchResolver } from './resolvers/search';

const allResolvers: NonEmptyArray<Function> = [
  /* ~~ Generated resolvers ~~ */
  UserRelationsResolver,
  ProfileRelationsResolver,
  OrganizationRelationsResolver,
  RepoRelationsResolver,
  ClaimRelationsResolver,
  GitPOAPRelationsResolver,
  FeaturedPOAPRelationsResolver,
  /* Auto-generated GitPOAP READ Resolvers */
  FindUniqueGitPOAPResolver,
  FindFirstGitPOAPResolver,
  FindManyGitPOAPResolver,
  /* Auto-generated User READ Resolvers */
  FindUniqueUserResolver,
  FindFirstUserResolver,
  FindManyUserResolver,
  /* Auto-generated Profile READ Resolvers */
  FindUniqueProfileResolver,
  FindFirstProfileResolver,
  FindManyProfileResolver,
  /* Auto-generated Organization READ Resolvers */
  FindUniqueOrganizationResolver,
  FindFirstOrganizationResolver,
  FindManyOrganizationResolver,
  /* Auto-generated Repo READ Resolvers */
  FindUniqueRepoResolver,
  FindFirstRepoResolver,
  FindManyRepoResolver,
  /* Auto-generated Claim READ Resolvers */
  FindUniqueClaimResolver,
  FindFirstClaimResolver,
  FindManyClaimResolver,
  /* Auto-generated FeaturedPOAP READ Resolvers */
  FindUniqueFeaturedPOAPResolver,
  FindFirstFeaturedPOAPResolver,
  FindManyFeaturedPOAPResolver,
  /* ~~ Custom resolvers ~~ */
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
