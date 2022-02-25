import { z } from 'zod';

export const AddProjectSchema = z.object({
  organization: z.string(),
  repository: z.string(),
});
