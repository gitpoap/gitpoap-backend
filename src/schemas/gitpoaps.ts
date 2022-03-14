import { z } from 'zod';

export const CreateGitPOAPSchema = z.object({
  githubRepoId: z.number(),
  name: z.string(),
  description: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  expiryDate: z.string(),
  eventUrl: z.string(),
  year: z.number(),
  image: z.string(),
  email: z.string(),
  requestedCodes: z.number(),
});
