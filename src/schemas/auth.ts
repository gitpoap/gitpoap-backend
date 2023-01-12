import { z } from 'zod';

export const CreateAccessTokenSchema = z.object({
  privyToken: z.string().nonempty(),
});
