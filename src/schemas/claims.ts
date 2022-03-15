import { z } from 'zod';

export const ClaimGitPOAPSchema = z.object({
  address: z.string(),
  claimIds: z.array(z.number()).nonempty(),
  signature: z.string(),
});

export const CreateGitPOAPClaimsSchema = z.object({
  gitPOAPId: z.number(),
  recipientGithubIds: z.array(z.number()).nonempty(),
});
