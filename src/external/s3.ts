import {
  S3Client,
  S3ClientConfig,
  PutObjectCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { AWS_PROFILE, NODE_ENV } from '../environment';

type S3ClientConfigProfile = S3ClientConfig & {
  buckets: Record<string, string>;
};

const S3_CONFIG_PROFILES: Record<'local' | 'prod', S3ClientConfigProfile> = {
  local: {
    region: 'us-east-2',
    credentials: fromIni({ profile: AWS_PROFILE }),
    buckets: {
      intakeForm: 'intake-form-test',
    },
  },
  prod: {
    region: 'us-east-2',
    buckets: {
      intakeForm: 'intake-form-prod',
    },
  },
};

export const s3configProfile = S3_CONFIG_PROFILES[NODE_ENV === 'local' ? 'local' : 'prod'];

export const s3 = new S3Client(s3configProfile);

export const uploadMulterFile = async (file: Express.Multer.File, bucket: string, key: string) => {
  const params: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  return await s3.send(new PutObjectCommand(params));
};
