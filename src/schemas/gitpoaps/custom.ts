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
  expiryDate: z.string().nonempty(),
  eventUrl: z.string().nonempty(),
  email: z.string().email().nonempty(),
  numRequestedCodes: z.string(),
  city: z.string().optional(),
  country: z.string().optional(),
  isEnabled: z.enum(['true', 'false']).optional(),
});

export const DeleteGitPOAPRequestClaimSchema = z.object({
  claimType: z.enum(['githubHandle', 'email', 'ethAddress', 'ensName']),
  claimData: z.string().nonempty(),
});
