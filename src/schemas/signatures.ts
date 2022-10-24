import { z } from 'zod';

export const SignatureDataSchema = z.object({
  signature: z.string().nonempty(),
  createdAt: z.number(),
});
