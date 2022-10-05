import { z } from 'zod';

export const RefreshAccessTokenSchema = z.object({
  token: z.string().nonempty(),
});
