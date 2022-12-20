import { mockDeep } from 'jest-mock-extended';
import { Multer } from 'multer';
import '../../../../../__mocks__/src/logging';
import { contextMock } from '../../../../../__mocks__/src/context';
import { StaffApprovalStatus, GitPOAPType } from '@prisma/client';
import { setupApp } from '../../../../../__mocks__/src/app';
import { generateAuthTokens } from '../../../../../src/lib/authTokens';
import request from 'supertest';
import {
  getImageBufferFromS3URL,
  getS3URL,
  S3ClientConfigProfile,
  uploadFileBuffer,
} from '../../../../../src/external/s3';
import { DateTime } from 'luxon';
import { STAFF_ADDRESSES, CUSTOM_GITPOAP_MINIMUM_CODES } from '../../../../../src/constants';
import { ADDRESSES, GH_HANDLES } from '../../../../../prisma/constants';
import { upsertEmail } from '../../../../../src/lib/emails';
import {
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
  startDate: DateTime.fromISO('2021-01-01').toJSDate(),
  endDate: DateTime.fromISO('2021-01-10').toJSDate(),
  expiryDate: DateTime.fromISO('2023-01-01').toJSDate(),
  eventUrl: 'https://foobar.com',
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
  staffApprovalStatus: StaffApprovalStatus.PENDING,
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
    uploadFileBuffer: jest.fn(),
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
              originalname: 'f-oo b@r.png',
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
jest.mocked(sendGitPOAPRequestConfirmationEmail, true);
jest.mocked(sendGitPOAPRequestRejectionEmail, true);

jest.spyOn(DateTime, 'now').mockReturnValue(DateTime.fromMillis(123456789));
const mockedGetImageBufferFromS3URL = jest.mocked(getImageBufferFromS3URL, true);
const mockedUploadFileBuffer = jest.mocked(uploadFileBuffer, true);

function genAuthTokens(someAddress?: string) {
  return generateAuthTokens(
    authTokenId,
    authTokenGeneration,
    addressId,
    someAddress ?? address,
    ensName,
    ensAvatarImageUrl,
    [],
    null,
    null,
    null,
    null,
    null,
  );
}

function mockJwtWithAddress() {
  contextMock.prisma.authToken.findUnique.mockResolvedValue({
    address: {
      ensName,
      ensAvatarImageUrl,
      email: null,
      memberships: [],
    },
  } as any);
}

describe('PUT /gitpoaps/custom/approve/:id', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/approve/${gitPOAPRequestId}`)
      .send();

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with non-staff Access Token provided', async () => {
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
    const authTokens = genAuthTokens(STAFF_ADDRESSES[0]);

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

  it('Returns 200 if the GitPOAP Request is already approved', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      id: gitPOAPRequestId,
      staffApprovalStatus: StaffApprovalStatus.APPROVED,
    } as any);
    const authTokens = genAuthTokens(STAFF_ADDRESSES[0]);

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
      staffApprovalStatus: StaffApprovalStatus.PENDING,
      description: 'foobar',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
      name: 'foobar',
      addressId,
      creatorEmailId,
    } as any);

    contextMock.prisma.gitPOAPRequest.update.mockResolvedValue({
      id: gitPOAPRequestId,
      staffApprovalStatus: StaffApprovalStatus.APPROVED,
    } as any);

    mockedCreatePOAPEvent.mockResolvedValue(null);

    const authTokens = genAuthTokens(STAFF_ADDRESSES[0]);

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
        staffApprovalStatus: StaffApprovalStatus.APPROVED,
      },
    });
    expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenNthCalledWith(2, {
      where: { id: gitPOAPRequestId },
      data: {
        staffApprovalStatus: StaffApprovalStatus.PENDING,
      },
    });

    expect(mockedCreatePOAPEvent).toHaveBeenCalledTimes(1);
  });

  it('Creates the POAP via the POAP API', async () => {
    mockedGetImageBufferFromS3URL.mockResolvedValue(Buffer.from(''));
    mockJwtWithAddress();

    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      id: gitPOAPRequestId,
      staffApprovalStatus: StaffApprovalStatus.PENDING,
      description: 'foobar',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
      name: 'foobar',
      addressId,
      creatorEmailId,
      startDate: DateTime.utc(2021, 2, 5).toJSDate(),
    } as any);

    contextMock.prisma.gitPOAPRequest.update.mockResolvedValue({
      id: gitPOAPRequestId,
      staffApprovalStatus: StaffApprovalStatus.APPROVED,
    } as any);

    mockedCreatePOAPEvent.mockResolvedValue({ id: 1, image_url: 'https://poap.xyz' } as any);

    contextMock.prisma.gitPOAP.create.mockResolvedValue({
      id: gitPOAPId,
      gitPOAPRequestId,
      staffApprovalStatus: StaffApprovalStatus.APPROVED,
    } as any);

    const authTokens = genAuthTokens(STAFF_ADDRESSES[0]);

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
        name: 'foobar',
        canRequestMoreCodes: true,
        year: 2021,
        poapEventId: 1,
        poapSecret: '123423123',
        team: undefined,
        project: undefined,
        creatorAddress: {
          connect: { id: addressId },
        },
        creatorEmail: {
          connect: { id: creatorEmailId },
        },
        gitPOAPRequest: {
          connect: { id: gitPOAPRequestId },
        },
      },
    });

    /* Updates the GitPOAP Request record in the DB */
    expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
      data: {
        staffApprovalStatus: StaffApprovalStatus.APPROVED,
      },
    });

    /* TODO: reenable after POAP fixes their issues with dates
    expect(contextMock.prisma.gitPOAPRequest.delete).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.delete).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
    });
    */
  });
});

describe('PUT /gitpoaps/custom/reject/:id', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/reject/${gitPOAPRequestId}`)
      .send({ rejectionReason: null });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with non-staff Access Token provided', async () => {
    mockJwtWithAddress();
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/reject/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ rejectionReason: null });

    expect(result.statusCode).toEqual(401);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
  });

  it('Fails with invalid request body', async () => {
    mockJwtWithAddress();
    const authTokens = genAuthTokens(STAFF_ADDRESSES[0]);

    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/reject/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ foo: 'bar' });

    expect(result.statusCode).toEqual(400);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
  });

  it('Fails and returns a 404 when the GitPOAP Request is not found', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(null);
    const authTokens = genAuthTokens(STAFF_ADDRESSES[0]);

    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/reject/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ rejectionReason: null });

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
      staffApprovalStatus: StaffApprovalStatus.APPROVED,
      description: 'foobar',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
      name: 'foobar',
      creatorEmailId,
    } as any);
    const authTokens = genAuthTokens(STAFF_ADDRESSES[0]);

    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/reject/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ rejectionReason: null });

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
      staffApprovalStatus: StaffApprovalStatus.REJECTED,
      description: 'foobar',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
      name: 'foobar',
    } as any);

    const authTokens = genAuthTokens(STAFF_ADDRESSES[0]);

    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/reject/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ rejectionReason: null });

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
      staffApprovalStatus: StaffApprovalStatus.PENDING,
      description: 'foobar',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
      name: 'foobar',
    } as any);

    contextMock.prisma.gitPOAPRequest.update.mockResolvedValue({
      id: gitPOAPRequestId,
      staffApprovalStatus: StaffApprovalStatus.REJECTED,
      team: {
        id: 1,
        name: 'team 1',
      },
      creatorEmail: {
        email: 'test@gitpoap.io',
      },
      rejectionReason: 'You did a terrible job with this. SHAME',
    } as any);

    const authTokens = genAuthTokens(STAFF_ADDRESSES[0]);
    const rejectionReason = 'You did a terrible job with this. SHAME';

    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/reject/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ rejectionReason });

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
        staffApprovalStatus: StaffApprovalStatus.REJECTED,
        rejectionReason,
      },
      select: {
        team: {
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
        rejectionReason: true,
      },
    });
  });

  it('should send a rejection email', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      ...baseGitPOAPRequest,
      id: gitPOAPRequestId,
      staffApprovalStatus: StaffApprovalStatus.PENDING,
      type: GitPOAPType.CUSTOM,
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar.png-123456789000'),
    } as any);

    contextMock.prisma.gitPOAPRequest.update.mockResolvedValue({
      id: gitPOAPRequestId,
      staffApprovalStatus: StaffApprovalStatus.REJECTED,
      team: {
        id: 1,
        name: 'team 1',
      },
      creatorEmail: {
        emailAddress: burzEmail,
      },
      rejectionReason: null,
    } as any);

    const authTokens = genAuthTokens(STAFF_ADDRESSES[0]);

    await request(await setupApp())
      .put(`/gitpoaps/custom/reject/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ rejectionReason: null });

    expect(sendGitPOAPRequestRejectionEmail).toHaveBeenCalledWith({
      id: gitPOAPRequestId,
      email: burzEmail,
      name: 'foobar-name',
      description: 'foobar-description',
      rejectionReason: '',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar.png-123456789000'),
      startDate: DateTime.fromISO('2021-01-01').toFormat('yyyy LLL dd'),
      endDate: DateTime.fromISO('2021-01-10').toFormat('yyyy LLL dd'),
    });
  });
});

describe('POST /gitpoaps/custom', () => {
  const assertGitPOAPRequestCreation = (teamId?: number, projectId?: number) => {
    expect(contextMock.prisma.gitPOAPRequest.create).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.create).toHaveBeenCalledWith({
      data: {
        name: 'foobar-name',
        description: 'foobar-description',
        imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
        startDate: DateTime.fromISO('2021-01-01').toJSDate(),
        endDate: DateTime.fromISO('2021-01-10').toJSDate(),
        creatorEmail: {
          connect: { id: creatorEmailId },
        },
        numRequestedCodes: CUSTOM_GITPOAP_MINIMUM_CODES,
        staffApprovalStatus: StaffApprovalStatus.PENDING,
        contributors: {
          githubHandles: ['peebeejay'],
          ensNames: ['burz.eth'],
        },
        address: { connect: { id: addressId } },
        team: teamId ? { connect: { id: teamId } } : undefined,
        project: projectId ? { connect: { id: projectId } } : undefined,
      },
    });

    /* Expect that the image was uploaded to S3 */
    expect(mockedUploadFileBuffer).toHaveBeenCalledTimes(1);
    expect(mockedUploadFileBuffer).toHaveBeenCalledWith(
      'gitpoap-request-images-test',
      'foobar-123456789.png',
      'image/png',
      Buffer.from('foobar'),
      undefined,
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
    mockedUploadFileBuffer.mockRejectedValueOnce(new Error('Failed to upload image to S3'));

    const result = await request(await setupApp())
      .post('/gitpoaps/custom')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({
        ...baseGitPOAPRequest,
        image: 'foobar',
      });

    expect(result.statusCode).toEqual(500);
    expect(result.body).toEqual({ msg: 'Failed to upload image' });
  });

  it('Fails when email upsert fails', async () => {
    mockJwtWithAddress();

    contextMock.prisma.gitPOAPRequest.create.mockResolvedValue({
      ...baseGitPOAPRequest,
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      staffApprovalStatus: StaffApprovalStatus.PENDING,
    } as any);

    mockedUploadFileBuffer.mockResolvedValue({
      filename: 'foobar_imgKey',
    } as any);

    mockedUpsertEmail.mockResolvedValue(null);

    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .post('/gitpoaps/custom')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ ...baseGitPOAPRequest });

    expect(result.statusCode).toEqual(500);
    expect(result.body).toEqual({ msg: 'Failed to setup email address' });
  });

  it('Successfully creates a new GitPOAP request with NO project or team', async () => {
    mockJwtWithAddress();

    contextMock.prisma.gitPOAPRequest.create.mockResolvedValue({
      ...baseGitPOAPRequest,
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      staffApprovalStatus: StaffApprovalStatus.PENDING,
    } as any);

    mockedUploadFileBuffer.mockResolvedValue({
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

  it('Successfully creates a new GitPOAP request with BOTH a project and a team', async () => {
    mockJwtWithAddress();

    contextMock.prisma.gitPOAPRequest.create.mockResolvedValue({
      ...baseGitPOAPRequest,
      id: gitPOAPRequestId,
      staffApprovalStatus: StaffApprovalStatus.PENDING,
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar.png-123456789000'),
    } as any);

    mockedUploadFileBuffer.mockResolvedValue({
      filename: 'foobar_imgKey',
    } as any);

    contextMock.prisma.project.findUnique.mockResolvedValue({ id: 1 } as any);
    contextMock.prisma.team.findUnique.mockResolvedValue({ id: 1 } as any);

    mockedUpsertEmail.mockResolvedValue({ id: creatorEmailId } as any);

    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .post('/gitpoaps/custom')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({
        ...baseGitPOAPRequest,
        teamId: '1',
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

    contextMock.prisma.team.findUnique.mockResolvedValue({
      id: 1,
      name: 'team 1',
    } as any);

    contextMock.prisma.gitPOAPRequest.create.mockResolvedValue({
      ...baseGitPOAPRequest,
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      staffApprovalStatus: StaffApprovalStatus.PENDING,
      isEnabled: true,
      isPRBased: false,
      isOngoing: false,
      canRequestMoreCodes: true,
      year: 2021,
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar.png-123456789000'),
      contributors: {
        githubHandles: ['peebeejay'],
        ensNames: ['burz.eth'],
      },
    } as any);

    mockedUploadFileBuffer.mockResolvedValue({
      filename: 'foobar_imgKey',
    } as any);

    const authTokens = genAuthTokens();
    await request(await setupApp())
      .post('/gitpoaps/custom')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({
        ...baseGitPOAPRequest,
        teamId: '1',
        projectId: '1',
      });

    expect(sendGitPOAPRequestConfirmationEmail).toHaveBeenCalledWith({
      id: gitPOAPRequestId,
      email: burzEmail,
      name: 'foobar-name',
      description: 'foobar-description',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar.png-123456789000'),
      startDate: DateTime.fromISO('2021-01-01').toFormat('yyyy LLL dd'),
      endDate: DateTime.fromISO('2021-01-10').toFormat('yyyy LLL dd'),
    });
  });
});

describe('PATCH /gitpoaps/custom/:gitPOAPRequestId', () => {
  it('Fails with no Access Token provided', async () => {
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(null);
    const result = await request(await setupApp())
      .patch(`/gitpoaps/custom/${gitPOAPRequestId}`)
      .send({});

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(0);
  });

  it('Fails with invalid body', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(null);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .patch(`/gitpoaps/custom/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ foobar: 'lolz' });

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(0);
  });

  const expectFindUniqueCalls = (count = 1) => {
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(count);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
      select: {
        addressId: true,
        staffApprovalStatus: true,
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
      .send({});

    expect(result.statusCode).toEqual(404);

    expectFindUniqueCalls();
  });

  it('Fails when user is not the owner or a staff member', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      ...gitPOAPRequest,
      addressId: addressId + 2,
    } as any);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .patch(`/gitpoaps/custom/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({});

    expect(result.statusCode).toEqual(401);

    expectFindUniqueCalls();
  });

  it('Fails when GitPOAPRequest is already APPROVED', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      ...gitPOAPRequest,
      staffApprovalStatus: StaffApprovalStatus.APPROVED,
    } as any);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .patch(`/gitpoaps/custom/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({});

    expect(result.statusCode).toEqual(400);

    expectFindUniqueCalls();
  });

  it('Updates the GitPOAPRequest with an image on success', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(gitPOAPRequest as any);
    const authTokens = genAuthTokens();
    {
      const name = 'YOLO';
      const description = "Let's yeet ourselves into 2023";
      const result = await request(await setupApp())
        .patch(`/gitpoaps/custom/${gitPOAPRequestId}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ name, description });
      expect(result.statusCode).toEqual(200);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(1);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledWith({
        where: { id: gitPOAPRequestId },
        data: {
          name,
          description,
          imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
          startDate: undefined,
          endDate: undefined,
          contributors: undefined,
          numRequestedCodes: undefined,
          staffApprovalStatus: StaffApprovalStatus.PENDING,
        },
      });
    }
    {
      const contributors = {};
      const result = await request(await setupApp())
        .patch(`/gitpoaps/custom/${gitPOAPRequestId}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ contributors: JSON.stringify(contributors) });
      expect(result.statusCode).toEqual(200);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(2);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenLastCalledWith({
        where: { id: gitPOAPRequestId },
        data: {
          name: undefined,
          description: undefined,
          imageUrl: getS3URL('gitpoap-request-images-test', 'foobar-123456789.png'),
          startDate: undefined,
          endDate: undefined,
          contributors,
          numRequestedCodes: CUSTOM_GITPOAP_MINIMUM_CODES,
          staffApprovalStatus: StaffApprovalStatus.PENDING,
        },
      });
    }

    expectFindUniqueCalls(2);

    /* Expect that the image was uploaded to S3 */
    expect(mockedUploadFileBuffer).toHaveBeenCalledTimes(2);
    expect(mockedUploadFileBuffer).toHaveBeenCalledWith(
      'gitpoap-request-images-test',
      'foobar-123456789.png',
      'image/png',
      Buffer.from('foobar'),
      undefined,
    );
  });
});
