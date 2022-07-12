import { z } from 'zod';

export const AddReposSchema = z.object({
  projectId: z.number(),
  githubRepoIds: z.array(z.number()).nonempty(),
});
