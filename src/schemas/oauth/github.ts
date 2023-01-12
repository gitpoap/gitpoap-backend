import { z } from 'zod';

export const RequestAccessTokenSchema = z.object({
  code: z.string().nonempty(),
});
