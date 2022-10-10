import { z } from 'zod';

export const AddEmailSchema = z.object({
  emailAddress: z.string().nonempty(),
});
