import { z } from 'zod';

const ProfileData = z.object({
  bio: z.string(),
  bannerImageUrl: z.nullable(z.string()),
  name: z.nullable(z.string()),
  profileImageUrl: z.nullable(z.string()),
});

export const UpdateProfileSchema = z.object({
  address: z.string(),
  data: ProfileData.partial(), // Allows the fields to be undefined in request
  signature: z.string(),
});
