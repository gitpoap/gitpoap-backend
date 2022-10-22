import { z } from 'zod';

export const SignatureSchema = z.object({
  data: z.string().nonempty(),
  message: z.string().nonempty(),
  createdAt: z.number(),
});
