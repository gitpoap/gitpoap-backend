import { z } from 'zod';

export const SignatureDataSchema = z.object({
  signature: z.string().nonempty(),
  message: z.string().nonempty(),
  createdAt: z.number(),
});
