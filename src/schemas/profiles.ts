import { z } from 'zod';

const ProfileData = z
  .object({
    bio: z.nullable(z.string()),
    bannerImageUrl: z.nullable(z.string()),
    name: z.nullable(z.string()),
    profileImageUrl: z.nullable(z.string()),
    isVisibleOnLeaderboard: z.boolean(),
  })
  .strict();

export const UpdateProfileSchema = z.object({
  data: ProfileData.partial(), // Allows the fields to be undefined in request
});
