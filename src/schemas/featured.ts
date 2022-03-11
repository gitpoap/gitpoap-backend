import { z } from 'zod';

export const AddFeaturedSchema = z.object({
  poapTokenId: z.number(),
  signature: z.string(),
});

export const RemoveFeaturedSchema = z.object({
  signature: z.string(),
});
