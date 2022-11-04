import { z } from 'zod';

// Everything is a string since it came from multipart
export const CreateGitPOAPSchema = z.object({
  project: z.string().nonempty(),
  name: z.string().nonempty(),
  description: z.string().nonempty(),
  startDate: z.string().nonempty(),
  endDate: z.string().nonempty(),
  expiryDate: z.string().nonempty(),
  eventUrl: z.string().nonempty(),
  year: z.string().nonempty(),
  numRequestedCodes: z.string().nonempty(),
  ongoing: z.enum(['true', 'false']),
  city: z.string().optional(),
  country: z.string().optional(),
  isPRBased: z.enum(['true', 'false']).optional(),
  isEnabled: z.enum(['true', 'false']).optional(),
});

export const CreateGitPOAPProjectSchema = z.union([
  z.object({
    githubRepoIds: z.array(z.number()).nonempty(),
  }),
  z.object({
    projectId: z.number(),
  }),
]);

// Everything is a string since it came from multipart
export const UploadGitPOAPCodesSchema = z.object({
  id: z.string().nonempty(),
});

export const GitPOAPContributorsSchema = z
  .object({
    githubHandles: z.array(z.string()).optional(),
    ethAddresses: z.array(z.string()).optional(),
    ensNames: z.array(z.string()).optional(),
    emails: z.array(z.string().email()).optional(),
  })
  .strict();

export const CreateGitPOAPClaimsSchema = z.object({
  contributors: GitPOAPContributorsSchema,
});
