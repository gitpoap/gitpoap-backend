import { z } from 'zod';

export const CreateTeamSchema = z.object({
  name: z.string(),
  description: z.string().nonempty().optional(),
  addresses: z.string().optional(),
});

export const AddressesSchema = z.array(z.string());
