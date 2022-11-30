import { z } from 'zod';

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

// Everything is a string since it came from multipart
export const UpdateCustomGitPOAPSchema = z
  .object({
    name: z.string().nonempty().optional(),
    description: z.string().nonempty().optional(),
    startDate: z.string().nonempty().optional(),
    endDate: z.string().nonempty().optional(),
    contributors: z.string().nonempty().optional(),
  })
  .strict();

export const RejectCustomGitPOAPSchema = z.object({
  rejectionReason: z.nullable(z.string().nonempty()),
});
