import {
  S3Client,
  S3ClientConfig,
  PutObjectCommand,
  PutObjectCommandInput,
  PutObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { AWS_PROFILE, NODE_ENV } from '../environment';
import fetch from 'cross-fetch';
import { createScopedLogger } from '../logging';
import parseDataURL from 'data-urls';

type S3ClientConfigProfile = S3ClientConfig & {
  buckets: Record<string, string>;
};

const S3_CONFIG_PROFILES: Record<'local' | 'prod', S3ClientConfigProfile> = {
  local: {
    region: 'us-east-2',
    credentials: fromIni({ profile: AWS_PROFILE }),
    buckets: {
      intakeForm: 'intake-form-test',
      ensAvatarCache: 'ens-avatar-cache-test',
    },
  },
  prod: {
    region: 'us-east-2',
    buckets: {
      intakeForm: 'intake-form-prod',
      ensAvatarCache: 'ens-avatar-cache-prod',
    },
  },
};

export const s3configProfile = S3_CONFIG_PROFILES[NODE_ENV === 'local' ? 'local' : 'prod'];

export const s3 = new S3Client(s3configProfile);

export const uploadMulterFile = async (
  file: Express.Multer.File,
  bucket: string,
  key: string,
): Promise<PutObjectCommandOutput> => {
  const params: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  return await s3.send(new PutObjectCommand(params));
};

export const uploadFileFromURL = async (
  url: string,
  bucket: string,
  key: string,
  isPublic?: boolean,
): Promise<PutObjectCommandOutput | null> => {
  const logger = createScopedLogger('uploadFileFromURL');

  let contentType: string;
  let buffer: Buffer;
  // Handle data URLs
  if (url.startsWith('data:')) {
    const result = parseDataURL(url);

    if (result === null) {
      logger.error(`Failed to parse data URL "${url}"`);
      return null;
    }

    contentType = result.mimeType.toString();
    buffer = Buffer.from(result.body);
  } else {
    let response;
    try {
      response = await fetch(url);

      if (response.status >= 400) {
        logger.error(
          `Failed to fetch file "${url}" [status: ${response.status}]: ${await response.text()}`,
        );
        return null;
      }
    } catch (err) {
      logger.error(`Error while fetching file "${url}": ${err}`);
      return null;
    }

    if (response.body === null) {
      logger.warn(`The file at "${url}" has no body`);
      return null;
    }

    const headerContentType = response.headers.get('content-type');

    if (headerContentType === null) {
      logger.warn(`The file at "${url}" has no Content-Type set`);
      return null;
    }

    contentType = headerContentType;
    buffer = Buffer.from(await response.arrayBuffer());
  }

  const acl = isPublic ? 'public-read' : undefined;

  const params: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: acl,
  };

  return await s3.send(new PutObjectCommand(params));
};

export function getS3URL(bucket: string, key: string): string {
  return `https://${bucket}.s3.${s3configProfile.region}.amazonaws.com/${key}`;
}
