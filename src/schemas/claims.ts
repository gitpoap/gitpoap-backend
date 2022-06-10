import { z } from 'zod';
import { SignatureSchema } from './signature';

export const ClaimGitPOAPSchema = z.object({
  address: z.string(),
  claimIds: z.array(z.number()).nonempty(),
  signature: SignatureSchema,
});

export const CreateGitPOAPClaimsSchema = z.object({
  gitPOAPId: z.number(),
  recipientGithubIds: z.array(z.number()).nonempty(),
});

export const CreateGitPOAPBotClaimsSchema = z.object({
  repo: z.string(),
  owner: z.string(),
  pullRequestNumber: z.number(),
});
