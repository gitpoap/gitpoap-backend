import { z } from 'zod';
import { SignatureSchema } from './signature';

const ProfileData = z.object({
  bio: z.nullable(z.string()),
  bannerImageUrl: z.nullable(z.string()),
  name: z.nullable(z.string()),
  profileImageUrl: z.nullable(z.string()),
  isVisibleOnLeaderboard: z.boolean(),
});

export const UpdateProfileSchema = z.object({
  address: z.string(),
  data: ProfileData.partial(), // Allows the fields to be undefined in request
  signature: SignatureSchema,
});
