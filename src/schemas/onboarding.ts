import { z } from 'zod';
import { MEGABYTES_TO_BYTES } from '../constants';

const MAX_FILE_SIZE = 5 * MEGABYTES_TO_BYTES;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const ImageFileSchema = z
  .any()
  .refine(file => file?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
  .refine(
    file => ACCEPTED_IMAGE_TYPES.includes(file?.mimetype),
    '.jpg, .jpeg, .png and .webp files are accepted.',
  );

export const IntakeFormImageFilesSchema = z.array(ImageFileSchema);

export const IntakeFormSchema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  notes: z.string().optional(),
  githubHandle: z.string(),
  shouldGitPOAPDesign: z.enum(['true', 'false']),
  isOneGitPOAPPerRepo: z.enum(['true', 'false']),
  repos: z.string(),
});

export const IntakeFormReposSchema = z.array(
  z.object({
    full_name: z.string(),
    githubRepoId: z.string(),
    permissions: z.object({
      admin: z.boolean(),
      maintain: z.boolean().optional(),
      push: z.boolean(),
      triage: z.boolean().optional(),
      pull: z.boolean(),
    }),
  }),
);
