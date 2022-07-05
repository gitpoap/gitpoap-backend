import { z } from 'zod';

export const RequestAccessTokenSchema = z.object({
  code: z.string().nonempty(),
});

export const RefreshAccessTokenSchema = z.object({
  token: z.string().nonempty(),
});
