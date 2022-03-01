import { z } from 'zod';

export const ClaimGitPOAPSchema = z.object({
  github_user_id: z.number(),
  address: z.string(),
  claim_ids: z.array(z.number()).nonempty(),
});
