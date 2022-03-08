import { z } from 'zod';

export const ClaimGitPOAPSchema = z.object({
  githubUserId: z.number(),
  address: z.string(),
  claimIds: z.array(z.number()).nonempty(),
  signature: z.string(),
});
