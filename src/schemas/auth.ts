import { z } from 'zod';
import { SignatureDataSchema } from './signatures';

export const CreateAccessTokenSchema = z.object({
  address: z.string().nonempty(),
  signatureData: SignatureDataSchema,
});

export const RefreshAccessTokenSchema = z.object({
  token: z.string().nonempty(),
});
