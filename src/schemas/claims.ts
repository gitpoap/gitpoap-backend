import { z } from 'zod';

export const ClaimGitPOAPSchema = z.object({
  address: z.string(),
  claim_ids: z.array(z.number()).nonempty(),
});
