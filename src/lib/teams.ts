import { safelyUploadMulterImage } from './images';
import { s3configProfile } from '../external/s3';

export async function uploadTeamLogoImage(image: Express.Multer.File): Promise<string | null> {
  return await safelyUploadMulterImage(s3configProfile.buckets.teamLogoImages, image);
}
