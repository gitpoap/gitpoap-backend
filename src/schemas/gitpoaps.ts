import { z } from 'zod';

// Everything is a string since it came from multipart
export const CreateGitPOAPSchema = z.object({
  githubRepoId: z.string(),
  name: z.string(),
  description: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  expiryDate: z.string(),
  eventUrl: z.string(),
  year: z.string(),
  email: z.string(),
  requestedCodes: z.string(),
});
