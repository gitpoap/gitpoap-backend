import { z } from 'zod';
import { SignatureSchema } from './signature';

export const AddFeaturedSchema = z.object({
  address: z.string(),
  poapTokenId: z.string(),
  signature: SignatureSchema,
});

export const RemoveFeaturedSchema = z.object({
  address: z.string(),
  signature: SignatureSchema,
});
