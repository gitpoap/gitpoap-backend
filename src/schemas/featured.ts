import { z } from 'zod';
import { SignatureSchema } from './signature';

export const AddFeaturedSchema = z.object({
  address: z.string().nonempty(),
  poapTokenId: z.string().nonempty(),
  signature: SignatureSchema,
});

export const RemoveFeaturedSchema = z.object({
  address: z.string().nonempty(),
  signature: SignatureSchema,
});
