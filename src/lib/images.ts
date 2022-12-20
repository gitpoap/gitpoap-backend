import { createScopedLogger } from '../logging';
import path from 'path';
import { uploadMulterFile } from '../external/s3';
import { DateTime } from 'luxon';

export async function safelyUploadMulterImage(
  bucket: string,
  image: Express.Multer.File,
): Promise<string | null> {
  const logger = createScopedLogger('safelyUploadMulterImage');

  logger.info(`Uploading image "${image.originalname}" to S3`);

  try {
    const extension = path.extname(image.originalname);
    const originalName = path.basename(image.originalname, extension);
    const name = originalName.replace(/[^a-zA-Z0-9]/g, '');
    const imageKey = `${name}-${DateTime.now().toMillis()}${extension}`;
    await uploadMulterFile(image, bucket, imageKey);
    logger.info(`Uploaded image with imageKey: ${imageKey} to S3 bucket ${bucket}`);
    return imageKey;
  } catch (err) {
    logger.error(`Received error when uploading image to S3: ${err}`);
    return null;
  }
}
