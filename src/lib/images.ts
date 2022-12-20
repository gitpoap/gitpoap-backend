import { createScopedLogger } from '../logging';
import path from 'path';
import { uploadFileBuffer } from '../external/s3';
import { DateTime } from 'luxon';

export async function safelyUploadImageBuffer(
  bucket: string,
  originalName: string,
  mimetype: string,
  buffer: Buffer,
  isPublic?: boolean,
): Promise<string | null> {
  const logger = createScopedLogger('safelyUploadImageBuffer');

  logger.info(`Uploading image "${originalName}" to S3`);

  try {
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    const name = baseName.replace(/[^a-zA-Z0-9]/g, '');
    const imageKey = `${name}-${DateTime.now().toMillis()}${extension}`;
    await uploadFileBuffer(bucket, imageKey, mimetype, buffer, isPublic);
    logger.info(`Uploaded image with imageKey: ${imageKey} to S3 bucket ${bucket}`);
    return imageKey;
  } catch (err) {
    logger.error(`Received error when uploading image to S3: ${err}`);
    return null;
  }
}
