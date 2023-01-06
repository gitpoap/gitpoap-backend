import { z } from 'zod';

export const CreateTeamSchema = z.object({
  name: z.string(),
  description: z.string().nonempty().optional(),
  addresses: z.array(z.string()).optional(),
});
