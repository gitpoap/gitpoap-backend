import { z } from 'zod';
import { GitPOAPContributorsSchema } from './';

// Everything is a string since it came from multipart
export const CreateCustomGitPOAPSchema = z.object({
  projectId: z.string().optional(),
  organizationId: z.string().optional(),
  name: z.string().nonempty(),
  contributors: z.string().nonempty(),
  description: z.string().nonempty(),
  startDate: z.string().nonempty(),
  endDate: z.string().nonempty(),
  creatorEmail: z.string().email().nonempty(),
});

const CustomGitPOAPData = z
  .object({
    name: z.string().nonempty(),
    description: z.string().nonempty(),
    startDate: z.string().nonempty(),
    endDate: z.string().nonempty(),
    contributors: GitPOAPContributorsSchema,
  })
  .strict();

export const UpdateCustomGitPOAPSchema = z.object({
  data: CustomGitPOAPData.partial(), // Allows the field to be undefined in the request
});
