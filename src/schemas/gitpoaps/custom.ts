import { z } from 'zod';

// Everything is a string since it came from multipart
export const CreateCustomGitPOAPSchema = z.object({
  projectId: z.number().optional(),
  organizationId: z.number().optional(),
  name: z.string().nonempty(),
  contributors: z.string(),
  description: z.string().nonempty(),
  startDate: z.string().nonempty(),
  endDate: z.string().nonempty(),
  expiryDate: z.string().nonempty(),
  eventUrl: z.string().nonempty(),
  email: z.string().email().nonempty(),
  numRequestedCodes: z.number(),
  ongoing: z.enum(['true', 'false']),
  city: z.string().optional(),
  country: z.string().optional(),
  isEnabled: z.enum(['true', 'false']).optional(),
});

export const CustomGitPOAPContributorsSchema = z.object({
  githubHandles: z.array(z.string()),
  ethAddresses: z.array(z.string()),
  ensNames: z.array(z.string()),
  emails: z.array(z.string().email()),
});
