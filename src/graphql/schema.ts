import { writeFileSync } from 'fs';
import { printSchema } from 'graphql/utilities';
import { format } from 'prettier';
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
  GithubPullRequestRelationsResolver,
  ProjectRelationsResolver,
  EmailRelationsResolver,
  /* Auto-generated GitPOAP Resolvers */
  FindUniqueGitPOAPResolver,
  FindFirstGitPOAPResolver,
  FindManyGitPOAPResolver,
  GroupByGitPOAPResolver,
  AggregateGitPOAPResolver,
  /* Auto-generated User Resolvers */
  FindUniqueUserResolver,
  FindFirstUserResolver,
  FindManyUserResolver,
  GroupByUserResolver,
  AggregateUserResolver,
  /* Auto-generated Profile Resolvers */
  FindUniqueProfileResolver,
  FindFirstProfileResolver,
  FindManyProfileResolver,
  GroupByProfileResolver,
  AggregateProfileResolver,
  /* Auto-generated Organization Resolvers */
  FindUniqueOrganizationResolver,
  FindFirstOrganizationResolver,
  FindManyOrganizationResolver,
  GroupByOrganizationResolver,
  AggregateOrganizationResolver,
  /* Auto-generated Repo Resolvers */
  FindUniqueRepoResolver,
  FindFirstRepoResolver,
  FindManyRepoResolver,
  GroupByRepoResolver,
  AggregateRepoResolver,
  /* Auto-generated Claim Resolvers */
  FindUniqueClaimResolver,
  FindFirstClaimResolver,
  FindManyClaimResolver,
  GroupByClaimResolver,
  AggregateClaimResolver,
  /* Auto-generated FeaturedPOAP Resolvers */
  FindUniqueFeaturedPOAPResolver,
  FindFirstFeaturedPOAPResolver,
  FindManyFeaturedPOAPResolver,
  GroupByFeaturedPOAPResolver,
  AggregateFeaturedPOAPResolver,
  /* Auto-generated GithubPullRequest Resolvers */
  FindUniqueGithubPullRequestResolver,
  FindFirstGithubPullRequestResolver,
  FindManyGithubPullRequestResolver,
  GroupByGithubPullRequestResolver,
  AggregateGithubPullRequestResolver,
  /* Auto-generated Project Resolvers */
  FindUniqueProjectResolver,
  FindFirstProjectResolver,
  FindManyProjectResolver,
  GroupByProjectResolver,
  AggregateProjectResolver,
  /* Auto-generated GithubIssue Resolvers */
  FindUniqueGithubIssueResolver,
  FindFirstGithubIssueResolver,
  FindManyGithubIssueResolver,
  GroupByGithubIssueResolver,
  AggregateGithubIssueResolver,
  /* Auto-generated GithubMention Resolvers */
  FindUniqueGithubMentionResolver,
  FindFirstGithubMentionResolver,
  FindManyGithubMentionResolver,
  GroupByGithubMentionResolver,
  AggregateGithubMentionResolver,
  /* Auto-generated Email Resolvers */
  FindUniqueEmailResolver,
  FindFirstEmailResolver,
  FindManyEmailResolver,
  GroupByEmailResolver,
  AggregateEmailResolver,
} from '@generated/type-graphql';
import { CustomClaimResolver } from './resolvers/claims';
import { CustomGitPOAPResolver } from './resolvers/gitpoaps';
import { CustomOrganizationResolver } from './resolvers/organizations';
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
  GithubPullRequestRelationsResolver,
  ProjectRelationsResolver,
  EmailRelationsResolver,
  /* Auto-generated GitPOAP READ Resolvers */
  FindUniqueGitPOAPResolver,
  FindFirstGitPOAPResolver,
  FindManyGitPOAPResolver,
  GroupByGitPOAPResolver,
  AggregateGitPOAPResolver,
  /* Auto-generated User READ Resolvers */
  FindUniqueUserResolver,
  FindFirstUserResolver,
  FindManyUserResolver,
  GroupByUserResolver,
  AggregateUserResolver,
  /* Auto-generated Profile READ Resolvers */
  FindUniqueProfileResolver,
  FindFirstProfileResolver,
  FindManyProfileResolver,
  GroupByProfileResolver,
  AggregateProfileResolver,
  /* Auto-generated Organization READ Resolvers */
  FindUniqueOrganizationResolver,
  FindFirstOrganizationResolver,
  FindManyOrganizationResolver,
  GroupByOrganizationResolver,
  AggregateOrganizationResolver,
  /* Auto-generated Repo READ Resolvers */
  FindUniqueRepoResolver,
  FindFirstRepoResolver,
  FindManyRepoResolver,
  GroupByRepoResolver,
  AggregateRepoResolver,
  /* Auto-generated Claim READ Resolvers */
  FindUniqueClaimResolver,
  FindFirstClaimResolver,
  FindManyClaimResolver,
  GroupByClaimResolver,
  AggregateClaimResolver,
  /* Auto-generated FeaturedPOAP READ Resolvers */
  FindUniqueFeaturedPOAPResolver,
  FindFirstFeaturedPOAPResolver,
  FindManyFeaturedPOAPResolver,
  GroupByFeaturedPOAPResolver,
  AggregateFeaturedPOAPResolver,
  /* Auto-generated GithubPullRequest READ Resolvers */
  FindUniqueGithubPullRequestResolver,
  FindFirstGithubPullRequestResolver,
  FindManyGithubPullRequestResolver,
  GroupByGithubPullRequestResolver,
  AggregateGithubPullRequestResolver,
  /* Auto-generated Project READ Resolvers */
  FindUniqueProjectResolver,
  FindFirstProjectResolver,
  FindManyProjectResolver,
  GroupByProjectResolver,
  AggregateProjectResolver,
  /* Auto-generated GithubIssue READ Resolvers */
  FindUniqueGithubIssueResolver,
  FindFirstGithubIssueResolver,
  FindManyGithubIssueResolver,
  GroupByGithubIssueResolver,
  AggregateGithubIssueResolver,
  /* Auto-generated GithubMention READ Resolvers */
  FindUniqueGithubMentionResolver,
  FindFirstGithubMentionResolver,
  FindManyGithubMentionResolver,
  GroupByGithubMentionResolver,
  AggregateGithubMentionResolver,
  /* Auto-generated Email Resolvers */
  FindUniqueEmailResolver,
  FindFirstEmailResolver,
  FindManyEmailResolver,
  GroupByEmailResolver,
  AggregateEmailResolver,
  /* ~~ Custom resolvers ~~ */
  CustomClaimResolver,
  CustomGitPOAPResolver,
  CustomOrganizationResolver,
  CustomProfileResolver,
  CustomRepoResolver,
  CustomSearchResolver,
];

const createSchema = async () =>
  await buildSchema({
    resolvers: allResolvers,
    validate: false,
  });

export const createAndEmitSchema = async () => {
  const schema = await createSchema();
  const schemaText = printSchema(schema, { commentDescriptions: true });
  const prettySchema = format(schemaText, { parser: 'graphql' });
  writeFileSync('schema.gql', prettySchema, 'utf8');

  return schema;
};

createAndEmitSchema();
