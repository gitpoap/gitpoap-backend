import { z } from 'zod';

import { SignatureSchema } from './signature';

export const AddEmailSchema = z.object({
  address: z.string().nonempty(),
  emailAddress: z.string().nonempty(),
  signature: SignatureSchema,
});

export const GetEmailSchema = z.object({
  ethAddress: z.string().nonempty(),
});

export const RemoveEmailSchema = z.object({
  address: z.string().nonempty(),
  id: z.number(),
  signature: SignatureSchema,
});

export const ValidateEmailSchema = z.object({
  activeToken: z.string().nonempty(),
});
