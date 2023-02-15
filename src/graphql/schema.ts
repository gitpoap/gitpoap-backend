import { writeFileSync } from 'fs';
import { printSchema } from 'graphql/utilities';
import { format } from 'prettier';
import { buildSchema, NonEmptyArray } from 'type-graphql';
import { authChecker } from './auth';
import { loggingAndTimingMiddleware } from './middleware';

import {
  /* Auto-generated Relation Resolvers */
  GithubUserRelationsResolver,
  DiscordUserRelationsResolver,
  ProfileRelationsResolver,
  GithubOrganizationRelationsResolver,
  RepoRelationsResolver,
  ClaimRelationsResolver,
  GitPOAPRelationsResolver,
  FeaturedPOAPRelationsResolver,
  GithubPullRequestRelationsResolver,
  ProjectRelationsResolver,
  GitPOAPRequestRelationsResolver,
  AddressRelationsResolver,
  /* Auto-generated GitPOAP Resolvers */
  FindUniqueGitPOAPResolver,
  FindFirstGitPOAPResolver,
  FindManyGitPOAPResolver,
  GroupByGitPOAPResolver,
  AggregateGitPOAPResolver,
  /* Auto-generated GithubUser Resolvers */
  FindUniqueGithubUserResolver,
  FindFirstGithubUserResolver,
  FindManyGithubUserResolver,
  GroupByGithubUserResolver,
  AggregateGithubUserResolver,
  /* Auto-generated DiscordUser Resolvers */
  FindUniqueDiscordUserResolver,
  FindFirstDiscordUserResolver,
  FindManyDiscordUserResolver,
  GroupByDiscordUserResolver,
  AggregateDiscordUserResolver,
  /* Auto-generated Profile Resolvers */
  FindUniqueProfileResolver,
  FindFirstProfileResolver,
  FindManyProfileResolver,
  GroupByProfileResolver,
  AggregateProfileResolver,
  /* Auto-generated GithubOrganization Resolvers */
  FindUniqueGithubOrganizationResolver,
  FindFirstGithubOrganizationResolver,
  FindManyGithubOrganizationResolver,
  GroupByGithubOrganizationResolver,
  AggregateGithubOrganizationResolver,
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
  /* Auto-generated GitPOAPRequest Resolvers */
  FindUniqueGitPOAPRequestResolver,
  FindFirstGitPOAPRequestResolver,
  FindManyGitPOAPRequestResolver,
  GroupByGitPOAPRequestResolver,
  AggregateGitPOAPRequestResolver,
  /* Auto-generated Address Resolvers */
  FindUniqueAddressResolver,
  FindFirstAddressResolver,
  FindManyAddressResolver,
  GroupByAddressResolver,
  AggregateAddressResolver,
  /* Auto-generated Email Resolvers */
  AggregateEmailResolver,
  /* Auto-generated Team Resolvers */
  FindUniqueTeamResolver,
  FindFirstTeamResolver,
  FindManyTeamResolver,
  GroupByTeamResolver,
  AggregateTeamResolver,
  /* Auto-generated Membership Resolvers */
  FindUniqueMembershipResolver,
  FindFirstMembershipResolver,
  FindManyMembershipResolver,
  GroupByMembershipResolver,
  AggregateMembershipResolver,
} from '@generated/type-graphql';
import { CustomClaimResolver } from './resolvers/claims';
import { CustomEmailResolver } from './resolvers/emails';
import { CustomGitPOAPResolver } from './resolvers/gitpoaps';
import { CustomMembershipResolver } from './resolvers/memberships';
import { CustomOrganizationResolver } from './resolvers/githubOrganizations';
import { CustomPermissionsResolver } from './resolvers/permissions';
import { CustomProfileResolver } from './resolvers/profiles';
import { CustomRepoResolver } from './resolvers/repos';
import { CustomSearchResolver } from './resolvers/search';
import { CustomTeamResolver } from './resolvers/teams';

type ResolverClass = { new (...args: any[]): any };

const allResolvers: NonEmptyArray<ResolverClass> = [
  /* ~~ Generated resolvers ~~ */
  GithubUserRelationsResolver,
  DiscordUserRelationsResolver,
  ProfileRelationsResolver,
  GithubOrganizationRelationsResolver,
  RepoRelationsResolver,
  ClaimRelationsResolver,
  GitPOAPRelationsResolver,
  FeaturedPOAPRelationsResolver,
  GithubPullRequestRelationsResolver,
  ProjectRelationsResolver,
  GitPOAPRequestRelationsResolver,
  AddressRelationsResolver,
  /* Auto-generated GitPOAP READ Resolvers */
  FindUniqueGitPOAPResolver,
  FindFirstGitPOAPResolver,
  FindManyGitPOAPResolver,
  GroupByGitPOAPResolver,
  AggregateGitPOAPResolver,
  /* Auto-generated GithubUser READ Resolvers */
  FindUniqueGithubUserResolver,
  FindFirstGithubUserResolver,
  FindManyGithubUserResolver,
  GroupByGithubUserResolver,
  AggregateGithubUserResolver,
  /* Auto-generated DiscordUser READ Resolvers */
  FindUniqueDiscordUserResolver,
  FindFirstDiscordUserResolver,
  FindManyDiscordUserResolver,
  GroupByDiscordUserResolver,
  AggregateDiscordUserResolver,
  /* Auto-generated Profile READ Resolvers */
  FindUniqueProfileResolver,
  FindFirstProfileResolver,
  FindManyProfileResolver,
  GroupByProfileResolver,
  AggregateProfileResolver,
  /* Auto-generated Organization READ Resolvers */
  FindUniqueGithubOrganizationResolver,
  FindFirstGithubOrganizationResolver,
  FindManyGithubOrganizationResolver,
  GroupByGithubOrganizationResolver,
  AggregateGithubOrganizationResolver,
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
  /* Auto-generated GitPOAPRequest Resolvers */
  FindUniqueGitPOAPRequestResolver,
  FindFirstGitPOAPRequestResolver,
  FindManyGitPOAPRequestResolver,
  GroupByGitPOAPRequestResolver,
  AggregateGitPOAPRequestResolver,
  /* Auto-generated Address Resolvers */
  FindUniqueAddressResolver,
  FindFirstAddressResolver,
  FindManyAddressResolver,
  GroupByAddressResolver,
  AggregateAddressResolver,
  /* Auto-generated Email Resolvers */
  AggregateEmailResolver,
  /* Auto-generated Team Resolvers */
  FindUniqueTeamResolver,
  FindFirstTeamResolver,
  FindManyTeamResolver,
  GroupByTeamResolver,
  AggregateTeamResolver,
  /* Auto-generated Membership Resolvers */
  FindUniqueMembershipResolver,
  FindFirstMembershipResolver,
  FindManyMembershipResolver,
  GroupByMembershipResolver,
  AggregateMembershipResolver,
  /* ~~ Custom resolvers ~~ */
  CustomClaimResolver,
  CustomEmailResolver,
  CustomGitPOAPResolver,
  CustomMembershipResolver,
  CustomOrganizationResolver,
  CustomPermissionsResolver,
  CustomProfileResolver,
  CustomRepoResolver,
  CustomSearchResolver,
  CustomTeamResolver,
];

export const createAndEmitSchema = async () => {
  const schema = await buildSchema({
    resolvers: allResolvers,
    validate: false,
    authChecker,
    globalMiddlewares: [loggingAndTimingMiddleware],
  });

  const schemaText = printSchema(schema, { commentDescriptions: true });
  const prettySchema = format(schemaText, { parser: 'graphql' });
  writeFileSync('schema.gql', prettySchema, 'utf8');

  return schema;
};

void createAndEmitSchema();
