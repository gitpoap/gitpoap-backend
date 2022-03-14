import { z } from 'zod';

export const AddFeaturedSchema = z.object({
  address: z.string(),
  poapTokenId: z.string(),
  signature: z.string(),
});

export const RemoveFeaturedSchema = z.object({
  address: z.string(),
  signature: z.string(),
});
