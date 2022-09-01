import { z } from 'zod';
import { SignatureSchema } from './signature';

export const ClaimGitPOAPSchema = z.object({
  address: z.string().nonempty(),
  claimIds: z.array(z.number()).nonempty(),
  signature: SignatureSchema,
});

export const CreateGitPOAPClaimsSchema = z.object({
  gitPOAPId: z.number(),
  recipientGithubIds: z.array(z.number()).nonempty(),
});

export const CreateGitPOAPBotClaimsForPRSchema = z.object({
  organization: z.string().nonempty(),
  repo: z.string().nonempty(),
  pullRequestNumber: z.number(),
});

export const CreateGitPOAPBotClaimsForIssueSchema = z.object({
  organization: z.string().nonempty(),
  repo: z.string().nonempty(),
  issueNumber: z.number(),
});

export const CreateGitPOAPBotClaimsSchema = z.union([
  z.object({
    pullRequest: CreateGitPOAPBotClaimsForPRSchema,
  }),
  z.object({
    issue: CreateGitPOAPBotClaimsForIssueSchema,
  }),
]);
