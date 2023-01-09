import { z } from 'zod';

export const CreateTeamSchema = z.object({
  name: z.string().nonempty(),
  description: z.string().nonempty().optional(),
  // Only can be set by GitPOAP staff members
  adminAddressId: z.number().optional(),
});
