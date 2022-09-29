import { z } from 'zod';

export const AddEmailSchema = z.object({
  emailAddress: z.string().nonempty(),
});

export const RemoveEmailSchema = z.object({
  id: z.number(),
});

export const ValidateEmailSchema = z.object({
  activeToken: z.string().nonempty(),
});
