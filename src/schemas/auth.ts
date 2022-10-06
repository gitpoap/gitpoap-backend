import { z } from 'zod';
import { SignatureSchema } from './signature';

export const CreateAccessTokenSchema = z.object({
  address: z.string().nonempty(),
  signature: SignatureSchema,
});

export const RefreshAccessTokenSchema = z.object({
  token: z.string().nonempty(),
});
