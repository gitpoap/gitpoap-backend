import { safelyUploadImageBuffer } from './images';
import { s3configProfile } from '../external/s3';
import sharp from 'sharp';
import { MAX_LOGO_IMAGE_SIZE } from '../constants';
import { createScopedLogger } from '../logging';
import { parseJSON } from './json';
import { AddressesSchema } from '../schemas/teams';

export async function uploadTeamLogoImage(image: Express.Multer.File): Promise<string | null> {
  const logger = createScopedLogger('uploadTeamLogoImage');

  const sharpImage = sharp(image.buffer);
  const metadata = await sharpImage.metadata();

  if (metadata.width === undefined || metadata.height === undefined) {
    logger.error('The uploaded image buffer is invalid');
    return null;
  }

  let buffer = image.buffer;
  if (metadata.width > MAX_LOGO_IMAGE_SIZE || metadata.height > MAX_LOGO_IMAGE_SIZE) {
    // Resize the image to be contained within the max height x max width
    buffer = await sharpImage
      .resize(MAX_LOGO_IMAGE_SIZE, MAX_LOGO_IMAGE_SIZE, {
        fit: 'contain',
      })
      .toBuffer();
  }

  return await safelyUploadImageBuffer(
    s3configProfile.buckets.teamLogoImages,
    image.originalname,
    image.mimetype,
    buffer,
    true,
  );
}

export function validateAddressesString(addressesString: string) {
  const logger = createScopedLogger('validateAddressesString');

  const addresses = parseJSON<string[]>(addressesString);

  if (addresses === null) {
    return null;
  }

  const addressesSchemaResult = AddressesSchema.safeParse(addresses);

  if (!addressesSchemaResult.success) {
    logger.warn(`Invalid Addresses: ${JSON.stringify(addressesSchemaResult.error.issues)}`);
    return null;
  }

  return addresses;
}
