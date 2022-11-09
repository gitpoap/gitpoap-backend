import { mockDeep } from 'jest-mock-extended';
import { Multer } from 'multer';
import '../../../../../__mocks__/src/logging';
import { contextMock } from '../../../../../__mocks__/src/context';
import { AdminApprovalStatus, GitPOAPType } from '@prisma/client';
import { setupApp } from '../../../../../__mocks__/src/app';
import { generateAuthTokens } from '../../../../../src/lib/authTokens';
import request from 'supertest';
import {
  getImageBufferFromS3URL,
  getS3URL,
  S3ClientConfigProfile,
  uploadMulterFile,
} from '../../../../../src/external/s3';
import { DateTime } from 'luxon';
import { ADMIN_ADDRESSES } from '../../../../../src/constants';
import { ADDRESSES, GH_HANDLES } from '../../../../../prisma/constants';
import { upsertEmail } from '../../../../../src/lib/emails';
import {
  sendGitPOAPRequestEmail,
  sendGitPOAPRequestConfirmationEmail,
  sendGitPOAPRequestRejectionEmail,
} from '../../../../../src/external/postmark';
import { createPOAPEvent } from '../../../../../src/external/poap';

const authTokenId = 4;
const authTokenGeneration = 1;
const addressId = 342;
const address = ADDRESSES.vitalik;
const gitPOAPRequestId = 2;
const gitPOAPId = 24;
const ensName = 'furby.eth';
const ensAvatarImageUrl = null;
const burzEmail = 'burz@gitpoap.io';
const burzENS = 'burz.eth';
const creatorEmailId = 234233;

const baseGitPOAPRequest = {
  name: 'foobar-name',
  description: 'foobar-description',
  startDate: '2021-01-01',
  endDate: '2021-01-10',
  expiryDate: '2023-01-01',
  eventUrl: 'https://foobar.com',
  numRequestedCodes: '50',
  ongoing: 'true',
  isEnabled: 'true',
  image: {
    data: Buffer.from('foobar'),
    mimetype: 'image/png',
    name: 'foobar.png',
    originalname: 'foobar.png',
  },
  contributors: JSON.stringify({
    githubHandles: ['peebeejay'],
    ensNames: ['burz.eth'],
  }),
  creatorEmail: burzEmail,
};

const gitPOAPRequest = {
  addressId,
  adminApprovalStatus: AdminApprovalStatus.PENDING,
  contributors: {
    githubHandles: [GH_HANDLES.burz],
    emails: [burzEmail],
    ethAddresses: [ADDRESSES.burz],
    ensNames: [burzENS],
  },
  gitPOAP: { id: gitPOAPId },
};

jest.mock('../../../../../src/logging');
jest.mock('../../../../../src/external/s3', () => {
  const originalModule = jest.requireActual('../../../../../src/external/s3');
  return {
    __esModule: true,
    ...originalModule,
    s3configProfile: <S3ClientConfigProfile>{
      region: 'us-east-2',
      buckets: {
        intakeForm: 'intake-form-test',
        ensAvatarCache: 'ens-avatar-cache-test',
        gitPOAPRequestImages: 'gitpoap-request-images-test',
      },
    },
    uploadMulterFile: jest.fn(),
    getImageBufferFromS3: jest.fn(),
    getImageBufferFromS3URL: jest.fn(),
  };
});

jest.mock('../../../../../src/lib/secrets', () => ({
  generatePOAPSecret: jest.fn().mockReturnValue('123423123'),
}));

jest.mock('../../../../../src/external/poap');

const mockedCreatePOAPEvent = jest.mocked(createPOAPEvent, true);

jest.mock('multer', () =>
  jest.fn().mockReturnValue(
    mockDeep<Multer>({
      single: jest.fn().mockReturnValue((req: any, res: any, next: any) => {
        req.file = {
          originalname: 'foobar.png',
          mimetype: 'image/png',
          buffer: Buffer.from('foobar'),
        };

        return next();
      }),
      array: () => {
        return (req: any, res: any, next: any) => {
          req.files = [
            {
              originalname: 'foobar.png',
              mimetype: 'image/png',
              buffer: Buffer.from('foobar'),
            },
          ];
          return next();
        };
      },
    }),
  ),
);

jest.mock('../../../../../src/lib/emails');
const mockedUpsertEmail = jest.mocked(upsertEmail, true);

jest.mock('../../../../../src/external/postmark');
jest.mocked(sendGitPOAPRequestEmail, true);
jest.mocked(sendGitPOAPRequestConfirmationEmail, true);
jest.mocked(sendGitPOAPRequestRejectionEmail, true);

jest.spyOn(DateTime, 'now').mockReturnValue(DateTime.fromSeconds(123456789));
const mockedGetImageBufferFromS3URL = jest.mocked(getImageBufferFromS3URL, true);
const mockedUploadMulterFile = jest.mocked(uploadMulterFile, true);

function genAuthTokens(someAddress?: string) {
  return generateAuthTokens(
    authTokenId,
    authTokenGeneration,
    addressId,
    someAddress ?? address,
    ensName,
    ensAvatarImageUrl,
    null,
    null,
  );
}

function mockJwtWithAddress() {
  contextMock.prisma.authToken.findUnique.mockResolvedValue({
    id: authTokenId,
    address: { ensName, ensAvatarImageUrl },
  } as any);
}

describe('PUT /gitpoaps/custom/approve/:id', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/approve/${gitPOAPRequestId}`)
      .send();

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with non-admin Access Token provided', async () => {
    mockJwtWithAddress();
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/approve/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(401);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
  });

  it('Returns a 404 when the GitPOAP Request is not found', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(null);
    const authTokens = genAuthTokens(ADMIN_ADDRESSES[0]);

    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/approve/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(404);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
    });
  });

  it('Returns 400 if the GitPOAP Request is not of type CUSTOM', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.ANNUAL,
      adminApprovalStatus: AdminApprovalStatus.PENDING,
    } as any);
    const authTokens = genAuthTokens(ADMIN_ADDRESSES[0]);

    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/approve/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(400);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
    });
  });

  it('Returns 200 if the GitPOAP Request is already approved', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.APPROVED,
    } as any);
    const authTokens = genAuthTokens(ADMIN_ADDRESSES[0]);

    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/approve/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(200);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
    });
  });

  it('Resets the GitPOAPRequest to PENDING if POAP API creation fails', async () => {
    mockedGetImageBufferFromS3URL.mockResolvedValue(Buffer.from(''));
    mockJwtWithAddress();

    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.PENDING,
      description: 'foobar',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
      isEnabled: true,
      isPRBased: false,
      name: 'foobar',
      ongoing: true,
      year: 2021,
      addressId,
      creatorEmailId,
    } as any);

    contextMock.prisma.gitPOAPRequest.update.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.APPROVED,
    } as any);

    mockedCreatePOAPEvent.mockResolvedValue(null);

    const authTokens = genAuthTokens(ADMIN_ADDRESSES[0]);

    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/approve/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(500);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
    });

    expect(contextMock.prisma.gitPOAP.create).toHaveBeenCalledTimes(0);

    /* Updates the GitPOAP Request record in the DB and resets it */
    expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(2);
    expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenNthCalledWith(1, {
      where: { id: gitPOAPRequestId },
      data: {
        adminApprovalStatus: AdminApprovalStatus.APPROVED,
      },
    });
    expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenNthCalledWith(2, {
      where: { id: gitPOAPRequestId },
      data: {
        adminApprovalStatus: AdminApprovalStatus.PENDING,
      },
    });

    expect(mockedCreatePOAPEvent).toHaveBeenCalledTimes(1);
  });

  it('Creates the POAP via the POAP API', async () => {
    mockedGetImageBufferFromS3URL.mockResolvedValue(Buffer.from(''));
    mockJwtWithAddress();

    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.PENDING,
      description: 'foobar',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
      isEnabled: true,
      isPRBased: false,
      name: 'foobar',
      ongoing: true,
      year: 2021,
      addressId,
      creatorEmailId,
    } as any);

    contextMock.prisma.gitPOAPRequest.update.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.APPROVED,
    } as any);

    mockedCreatePOAPEvent.mockResolvedValue({ id: 1, image_url: 'https://poap.xyz' } as any);

    contextMock.prisma.gitPOAP.create.mockResolvedValue({
      id: gitPOAPId,
      gitPOAPRequestId,
      adminApprovalStatus: AdminApprovalStatus.APPROVED,
    } as any);

    const authTokens = genAuthTokens(ADMIN_ADDRESSES[0]);

    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/approve/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(200);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
    });

    expect(mockedCreatePOAPEvent).toHaveBeenCalledTimes(1);

    /* Creates a new GitPOAP record in the DB */
    expect(contextMock.prisma.gitPOAP.create).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAP.create).toHaveBeenCalledWith({
      data: {
        type: GitPOAPType.CUSTOM,
        description: 'foobar',
        imageUrl: 'https://poap.xyz',
        isEnabled: true,
        isPRBased: false,
        name: 'foobar',
        ongoing: true,
        year: 2021,
        poapEventId: 1,
        poapSecret: '123423123',
        organization: undefined,
        project: undefined,
        creatorAddress: {
          connect: { id: addressId },
        },
        creatorEmail: {
          connect: { id: creatorEmailId },
        },
      },
    });

    /* Updates the GitPOAP Request record in the DB */
    expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
      data: {
        adminApprovalStatus: AdminApprovalStatus.APPROVED,
      },
    });

    expect(contextMock.prisma.gitPOAPRequest.delete).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.delete).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
    });
  });
});

describe('PUT /gitpoaps/custom/reject/:id', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/reject/${gitPOAPRequestId}`)
      .send();

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with non-admin Access Token provided', async () => {
    mockJwtWithAddress();
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/reject/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(401);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
  });

  it('Fails and returns a 404 when the GitPOAP Request is not found', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(null);
    const authTokens = genAuthTokens(ADMIN_ADDRESSES[0]);

    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/reject/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(404);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
    });
  });

  it('Fails and returns 400 when the GitPOAP Request is already approved', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.APPROVED,
      description: 'foobar',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
      isEnabled: true,
      isPRBased: false,
      name: 'foobar',
      ongoing: true,
      year: 2021,
      creatorEmailId,
    } as any);
    const authTokens = genAuthTokens(ADMIN_ADDRESSES[0]);

    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/reject/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(400);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
    });
  });

  it('Fails and returns 400 when the GitPOAP Request is already rejected', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.REJECTED,
      description: 'foobar',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
      isEnabled: true,
      isPRBased: false,
      name: 'foobar',
      ongoing: true,
      year: 2021,
    } as any);

    const authTokens = genAuthTokens(ADMIN_ADDRESSES[0]);

    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/reject/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(200);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
    });
  });

  it('Updates the GitPOAP Request status in the DB to be REJECTED', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.PENDING,
      description: 'foobar',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
      isEnabled: true,
      isPRBased: false,
      name: 'foobar',
      ongoing: true,
      year: 2021,
    } as any);

    contextMock.prisma.gitPOAPRequest.update.mockResolvedValue({
      id: gitPOAPRequestId,
      adminApprovalStatus: AdminApprovalStatus.REJECTED,
      organization: {
        id: 1,
        name: 'organization 1',
      },
      creatorEmail: {
        email: 'test@gitpoap.io',
      },
    } as any);

    const authTokens = genAuthTokens(ADMIN_ADDRESSES[0]);

    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/reject/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(200);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
    });

    /* Updates the GitPOAP Request record in the DB */
    expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
      data: {
        adminApprovalStatus: AdminApprovalStatus.REJECTED,
      },
      select: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        creatorEmail: {
          select: {
            emailAddress: true,
          },
        },
      },
    });
  });

  it('should send a rejection email', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      id: gitPOAPRequestId,
      creatorEmail: 'test@gitpoap.io',
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.PENDING,
      description: 'foobar-description',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
      isEnabled: true,
      isPRBased: false,
      name: 'foobar',
      ongoing: true,
      year: 2021,
    } as any);

    contextMock.prisma.gitPOAPRequest.update.mockResolvedValue({
      id: gitPOAPRequestId,
      adminApprovalStatus: AdminApprovalStatus.REJECTED,
      organization: {
        id: 1,
        name: 'organization 1',
      },
      creatorEmail: {
        emailAddress: 'test@gitpoap.io',
      },
    } as any);

    const authTokens = genAuthTokens(ADMIN_ADDRESSES[0]);

    await request(await setupApp())
      .put(`/gitpoaps/custom/reject/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(sendGitPOAPRequestRejectionEmail).toHaveBeenCalledWith({
      id: gitPOAPRequestId,
      email: 'test@gitpoap.io',
      name: 'foobar',
      description: 'foobar-description',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
      organizationId: 1,
      organizationName: 'organization 1',
    });
  });
});

describe('POST /gitpoaps/custom', () => {
  const assertGitPOAPRequestCreation = (orgId?: number, projectId?: number) => {
    expect(contextMock.prisma.gitPOAPRequest.create).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.create).toHaveBeenCalledWith({
      data: {
        name: 'foobar-name',
        description: 'foobar-description',
        imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
        type: GitPOAPType.CUSTOM,
        year: 2021,
        startDate: DateTime.fromISO('2021-01-01').toJSDate(),
        endDate: DateTime.fromISO('2021-01-10').toJSDate(),
        expiryDate: DateTime.fromISO('2023-01-01').toJSDate(),
        eventUrl: 'https://foobar.com',
        creatorEmail: {
          connect: { id: creatorEmailId },
        },
        numRequestedCodes: 50,
        adminApprovalStatus: AdminApprovalStatus.PENDING,
        isEnabled: true,
        isPRBased: false, // They should never be PR-based
        ongoing: true,
        contributors: {
          githubHandles: ['peebeejay'],
          ensNames: ['burz.eth'],
        },
        address: { connect: { id: addressId } },
        organization: orgId ? { connect: { id: orgId } } : undefined,
        project: projectId ? { connect: { id: projectId } } : undefined,
      },
    });

    /* Expect that the image was uploaded to S3 */
    expect(mockedUploadMulterFile).toHaveBeenCalledTimes(1);
    expect(mockedUploadMulterFile).toHaveBeenCalledWith(
      {
        buffer: Buffer.from('foobar'),
        mimetype: 'image/png',
        originalname: 'foobar.png',
      },
      'gitpoap-request-images-test',
      'foobar-123456789.png',
    );
  };

  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .post('/gitpoaps/custom')
      .send();

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with invalid body', async () => {
    mockJwtWithAddress();
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .post('/gitpoaps/custom')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ bad: 'body' });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with invalid body - contributors is not a valid object', async () => {
    mockJwtWithAddress();
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .post('/gitpoaps/custom')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({
        ...baseGitPOAPRequest,
        contributors: JSON.stringify('blah'),
      });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with invalid body - contributors is wrong structure', async () => {
    mockJwtWithAddress();
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .post('/gitpoaps/custom')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({
        ...baseGitPOAPRequest,
        contributors: JSON.stringify({
          blah1: ['peebeejay'],
          blah2: ['burz.eth'],
        }),
      });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails when the s3 image upload fails', async () => {
    mockJwtWithAddress();
    const authTokens = genAuthTokens();
    mockedUploadMulterFile.mockRejectedValueOnce(new Error('Failed to upload image to S3'));

    const result = await request(await setupApp())
      .post('/gitpoaps/custom')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({
        ...baseGitPOAPRequest,
        image: 'foobar',
      });

    expect(result.statusCode).toEqual(500);
    expect(result.body).toEqual({
      msg: 'Failed to upload image to S3',
    });
  });

  it('Successfully creates a new GitPOAP request with NO project or organization', async () => {
    mockJwtWithAddress();

    contextMock.prisma.gitPOAPRequest.create.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.PENDING,
    } as any);

    mockedUploadMulterFile.mockResolvedValue({
      filename: 'foobar_imgKey',
    } as any);

    mockedUpsertEmail.mockResolvedValue({ id: creatorEmailId } as any);

    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .post('/gitpoaps/custom')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ ...baseGitPOAPRequest });

    expect(result.statusCode).toEqual(201);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);

    expect(mockedUpsertEmail).toHaveBeenCalledTimes(1);
    expect(mockedUpsertEmail).toHaveBeenCalledWith(burzEmail);

    assertGitPOAPRequestCreation();
  });

  it('Successfully creates a new GitPOAP request with BOTH a project and an organization', async () => {
    mockJwtWithAddress();

    contextMock.prisma.gitPOAPRequest.create.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.PENDING,
    } as any);

    mockedUploadMulterFile.mockResolvedValue({
      filename: 'foobar_imgKey',
    } as any);

    contextMock.prisma.project.findUnique.mockResolvedValue({ id: 1 } as any);
    contextMock.prisma.organization.findUnique.mockResolvedValue({ id: 1 } as any);

    mockedUpsertEmail.mockResolvedValue({ id: creatorEmailId } as any);

    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .post('/gitpoaps/custom')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({
        ...baseGitPOAPRequest,
        organizationId: '1',
        projectId: '1',
      });

    expect(result.statusCode).toEqual(201);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);

    expect(mockedUpsertEmail).toHaveBeenCalledTimes(1);
    expect(mockedUpsertEmail).toHaveBeenCalledWith(burzEmail);

    assertGitPOAPRequestCreation(1, 1);
  });

  it('should send gitPOAPRequest submission confirmation email', async () => {
    mockJwtWithAddress();

    contextMock.prisma.organization.findUnique.mockResolvedValue({
      id: 1,
      name: 'organization 1',
    } as any);

    contextMock.prisma.gitPOAPRequest.create.mockResolvedValue({
      id: gitPOAPRequestId,
      creatorEmail: 'test@gitpoap.io',
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.PENDING,
      description: 'foobar',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
      isEnabled: true,
      isPRBased: false,
      name: 'foobar-name',
      ongoing: true,
      year: 2021,
    } as any);

    mockedUploadMulterFile.mockResolvedValue({
      filename: 'foobar_imgKey',
    } as any);

    const authTokens = genAuthTokens();
    await request(await setupApp())
      .post('/gitpoaps/custom')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({
        ...baseGitPOAPRequest,
        organizationId: '1',
        projectId: '1',
      });

    expect(sendGitPOAPRequestConfirmationEmail).toHaveBeenCalledWith({
      id: gitPOAPRequestId,
      email: burzEmail,
      name: 'foobar-name',
      description: 'foobar',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
      organizationId: 1,
      organizationName: 'organization 1',
    });
  });
});

describe('PATCH /gitpoaps/custom/:gitPOAPRequestId', () => {
  it('Fails with no Access Token provided', async () => {
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(null);
    const result = await request(await setupApp())
      .patch(`/gitpoaps/custom/${gitPOAPRequestId}`)
      .send({ data: {} });

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(0);
  });

  it('Fails with invalid body', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(null);
    const authTokens = genAuthTokens();
    {
      const result = await request(await setupApp())
        .patch(`/gitpoaps/custom/${gitPOAPRequestId}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ foobar: 'lolz' });
      expect(result.statusCode).toEqual(400);
    }
    {
      const result = await request(await setupApp())
        .patch(`/gitpoaps/custom/${gitPOAPRequestId}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ data: { foobar: '' } });
      expect(result.statusCode).toEqual(400);
    }

    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(0);
  });

  const expectFindUniqueCalls = (count = 1) => {
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(count);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
      select: {
        addressId: true,
        adminApprovalStatus: true,
      },
    });
  };

  it('Fails when GitPOAPRequest not found', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(null);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .patch(`/gitpoaps/custom/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ data: {} });

    expect(result.statusCode).toEqual(404);

    expectFindUniqueCalls();
  });

  it('Fails when user is not the owner', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      ...gitPOAPRequest,
      addressId: addressId + 2,
    } as any);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .patch(`/gitpoaps/custom/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ data: {} });

    expect(result.statusCode).toEqual(401);

    expectFindUniqueCalls();
  });

  it('Fails when GitPOAPRequest is already APPROVED', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      ...gitPOAPRequest,
      adminApprovalStatus: AdminApprovalStatus.APPROVED,
    } as any);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .patch(`/gitpoaps/custom/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ data: {} });

    expect(result.statusCode).toEqual(400);

    expectFindUniqueCalls();
  });

  it('Updates the GitPOAPRequest on success', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(gitPOAPRequest as any);
    const authTokens = genAuthTokens();
    {
      const name = 'YOLO';
      const description = "Let's yeet ourselves into 2023";
      const result = await request(await setupApp())
        .patch(`/gitpoaps/custom/${gitPOAPRequestId}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ data: { name, description } });
      expect(result.statusCode).toEqual(200);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(1);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledWith({
        where: { id: gitPOAPRequestId },
        data: { name, description },
      });
    }
    {
      const country = 'USA';
      const result = await request(await setupApp())
        .patch(`/gitpoaps/custom/${gitPOAPRequestId}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ data: { country } });
      expect(result.statusCode).toEqual(200);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(2);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenLastCalledWith({
        where: { id: gitPOAPRequestId },
        data: { country },
      });
    }
    {
      const city = null;
      const result = await request(await setupApp())
        .patch(`/gitpoaps/custom/${gitPOAPRequestId}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ data: { city } });
      expect(result.statusCode).toEqual(200);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(3);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenLastCalledWith({
        where: { id: gitPOAPRequestId },
        data: { city },
      });
    }

    expectFindUniqueCalls(3);
  });
});
