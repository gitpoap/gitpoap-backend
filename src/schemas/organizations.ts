import { z } from 'zod';

const OrganizationData = z.object({
  description: z.nullable(z.string()),
  twitterHandle: z.nullable(z.string()),
  url: z.nullable(z.string()),
});

export const UpdateOrganizationSchema = z.object({
  id: z.number(),
  data: OrganizationData.partial(), // Allows the fields to be undefined in request
});
