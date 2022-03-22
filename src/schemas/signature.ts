import { z } from 'zod';

export const SignatureSchema = z.object({
  data: z.string(),
  createdAt: z.number(),
});
