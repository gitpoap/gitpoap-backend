import { z } from 'zod';

export const ClaimGitPOAPSchema = z.object({
  claimIds: z.array(z.number()).nonempty(),
});

export const CreateGitPOAPClaimsSchema = z.object({
  gitPOAPId: z.number(),
  recipientGithubIds: z.array(z.number()).nonempty(),
});

export const CreateGitPOAPBotClaimsForPRSchema = z.object({
  organization: z.string().nonempty(),
  repo: z.string().nonempty(),
  pullRequestNumber: z.number(),
  contributorGithubIds: z.array(z.number()).nonempty(),
  wasEarnedByMention: z.boolean(),
});

export const CreateGitPOAPBotClaimsForIssueSchema = z.object({
  organization: z.string().nonempty(),
  repo: z.string().nonempty(),
  issueNumber: z.number(),
  contributorGithubIds: z.array(z.number()).nonempty(),
  wasEarnedByMention: z.boolean(),
});

export const CreateGitPOAPBotClaimsSchema = z.union([
  z.object({
    pullRequest: CreateGitPOAPBotClaimsForPRSchema,
  }),
  z.object({
    issue: CreateGitPOAPBotClaimsForIssueSchema,
  }),
]);
