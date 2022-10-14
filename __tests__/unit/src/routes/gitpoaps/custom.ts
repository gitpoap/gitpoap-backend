import { mockDeep } from 'jest-mock-extended';
import { Multer } from 'multer';
import '../../../../../__mocks__/src/logging';
import { contextMock } from '../../../../../__mocks__/src/context';
import { AdminApprovalStatus, GitPOAPType } from '@prisma/client';
import { setupApp } from '../../../../../src/app';
import { generateAuthTokens } from '../../../../../src/lib/authTokens';
import request from 'supertest';
import { getImageBufferFromS3, uploadMulterFile } from '../../../../../src/external/s3';
import { DateTime } from 'luxon';
import { ADMIN_GITHUB_IDS } from '../../../../../src/constants';

const authTokenId = 4;
const authTokenGeneration = 1;
const addressId = 342;
const address = '0xburzistheword';
const githubId = 232444;
const githubOAuthToken = 'foobar34543';
const githubHandle = 'anna-burz';
const gitPOAPRequestId = 2;
const gitPOAPId = 24;
const ensName = 'furby.eth';
const ensAvatarImageUrl = null;

jest.mock('../../../../../src/logging');
jest.mock('../../../../../src/external/s3', () => {
  const originalModule = jest.requireActual('../../../../../src/external/s3');
  return {
    __esModule: true,
    ...originalModule,
    s3configProfile: {
      region: 'us-east-2',
      buckets: {
        intakeForm: 'intake-form-test',
        ensAvatarCache: 'ens-avatar-cache-test',
        gitPOAPRequest: 'gitpoap-request-images-test',
      },
    },
    uploadMulterFile: jest.fn(),
    getImageBufferFromS3: jest.fn(),
  };
});

jest.mock('../../../../../src/lib/secrets', () => ({
  generatePOAPSecret: jest.fn().mockReturnValue('123423123'),
}));

jest.mock('../../../../../src/external/poap', () => ({
  createPOAPEvent: jest
    .fn()
    .mockResolvedValue({ id: 1, image_url: 'https://poap.xyz', poapEventId: 1 }),
}));

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

const mockedGetImageBufferFromS3 = jest.mocked(getImageBufferFromS3, true);
const mockedUploadMulterFile = jest.mocked(uploadMulterFile, true);

function mockJwtWithOAuth() {
  contextMock.prisma.authToken.findUnique.mockResolvedValue({
    address: { ensName, ensAvatarImageUrl },
    user: { githubOAuthToken },
  } as any);
}

function genAuthTokens(someGithubId?: number, githubHandle?: string) {
  return generateAuthTokens(
    authTokenId,
    authTokenGeneration,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    someGithubId ?? null,
    githubHandle ?? null,
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
    mockJwtWithOAuth();
    const authTokens = genAuthTokens(githubId, githubHandle);
    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/approve/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(401);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
  });

  it('Returns a 404 when the GitPOAP Request is not found', async () => {
    mockJwtWithOAuth();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(null);
    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0], githubHandle);

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
    mockJwtWithOAuth();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.ANNUAL,
      adminApprovalStatus: AdminApprovalStatus.PENDING,
    } as any);
    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0], githubHandle);

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

  it('Returns 400 if the GitPOAP Request is already approved', async () => {
    mockJwtWithOAuth();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.APPROVED,
    } as any);
    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0], githubHandle);

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

  it('Creates the POAP via the POAP API', async () => {
    mockedGetImageBufferFromS3.mockResolvedValue(Buffer.from(''));
    mockJwtWithOAuth();

    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.PENDING,
      description: 'foobar',
      imageKey: 'foobar_imgKey',
      isEnabled: true,
      isPRBased: false,
      name: 'foobar',
      ongoing: true,
      year: 2021,
    } as any);

    contextMock.prisma.gitPOAPRequest.update.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.APPROVED,
    } as any);

    contextMock.prisma.gitPOAP.create.mockResolvedValue({
      id: gitPOAPId,
      gitPOAPRequestId,
      adminApprovalStatus: AdminApprovalStatus.APPROVED,
    } as any);

    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0], githubHandle);

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
        organization: {
          connect: {
            id: undefined,
          },
        },
        project: {
          connect: {
            id: undefined,
          },
        },
      },
    });

    /* Updates the GitPOAP Request record in the DB */
    expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
      data: {
        adminApprovalStatus: AdminApprovalStatus.APPROVED,
        gitPOAP: {
          connect: {
            id: gitPOAPId,
          },
        },
      },
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
    mockJwtWithOAuth();
    const authTokens = genAuthTokens(githubId, githubHandle);
    const result = await request(await setupApp())
      .put(`/gitpoaps/custom/reject/${gitPOAPRequestId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(401);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
  });

  it('Returns a 404 when the GitPOAP Request is not found', async () => {
    mockJwtWithOAuth();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(null);
    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0], githubHandle);

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

  it('updates the GitPOAP Request status in the DB to be REJECTED', async () => {
    mockJwtWithOAuth();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.PENDING,
      description: 'foobar',
      imageKey: 'foobar_imgKey',
      isEnabled: true,
      isPRBased: false,
      name: 'foobar',
      ongoing: true,
      year: 2021,
    } as any);

    contextMock.prisma.gitPOAPRequest.update.mockResolvedValue({
      id: gitPOAPRequestId,
      adminApprovalStatus: AdminApprovalStatus.REJECTED,
    } as any);

    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0], githubHandle);

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
    });
  });
});

describe('POST /gitpoaps/custom', () => {
  afterAll(() => {
    jest.resetAllMocks();
  });

  const assertGitPOAPRequestCreation = (orgId?: number, projectId?: number) => {
    expect(contextMock.prisma.gitPOAPRequest.create).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.create).toHaveBeenCalledWith({
      data: {
        name: 'foobar-name',
        description: 'foobar-description',
        imageKey: '',
        type: GitPOAPType.CUSTOM,
        year: 2021,
        startDate: DateTime.fromISO('2021-01-01').toJSDate(),
        endDate: DateTime.fromISO('2021-01-10').toJSDate(),
        expiryDate: DateTime.fromISO('2023-01-01').toJSDate(),
        eventUrl: 'https://foobar.com',
        email: 'jay@gitpoap.io',
        numRequestedCodes: 50,
        adminApprovalStatus: AdminApprovalStatus.PENDING,
        isEnabled: true,
        isPRBased: false, // They should never be PR-based
        ongoing: true,
        contributors: {
          githubHandles: ['peebeejay'],
          ensNames: ['burz.eth'],
        },
        ...(orgId && { organization: { connect: { id: orgId } } }),
        ...(projectId && { project: { connect: { id: projectId } } }),
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
      `foobar.png-${gitPOAPRequestId}`,
    );

    /* Expect prisma.gitPOAPRequest.update to be called with the correct data */
    expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
      data: { imageKey: `foobar.png-${gitPOAPRequestId}` },
    });
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

  it('Fails with invalid body - contributors', async () => {
    mockJwtWithAddress();
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .post('/gitpoaps/custom')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({
        name: 'foobar-name',
        description: 'foobar-description',
        startDate: '2021-01-01',
        endDate: '2021-01-10',
        expiryDate: '2023-01-01',
        eventUrl: 'https://foobar.com',
        email: 'jay@gitpoap.io',
        numRequestedCodes: 50,
        ongoing: 'true',
        isEnabled: 'true',
        year: 2021,
        image: {
          data: Buffer.from('foobar'),
          mimetype: 'image/png',
          name: 'foobar.png',
          originalname: 'foobar.png',
        },
        contributors: JSON.stringify({
          blah1: ['peebeejay'],
          blah2: ['burz.eth'],
        }),
      });

    expect(result.statusCode).toEqual(400);
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

    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .post('/gitpoaps/custom')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({
        name: 'foobar-name',
        description: 'foobar-description',
        startDate: '2021-01-01',
        endDate: '2021-01-10',
        expiryDate: '2023-01-01',
        eventUrl: 'https://foobar.com',
        email: 'jay@gitpoap.io',
        numRequestedCodes: 50,
        ongoing: 'true',
        isEnabled: 'true',
        year: 2021,
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
      });

    expect(result.statusCode).toEqual(201);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
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

    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .post('/gitpoaps/custom')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({
        name: 'foobar-name',
        description: 'foobar-description',
        startDate: '2021-01-01',
        endDate: '2021-01-10',
        expiryDate: '2023-01-01',
        eventUrl: 'https://foobar.com',
        email: 'jay@gitpoap.io',
        numRequestedCodes: 50,
        ongoing: 'true',
        isEnabled: 'true',
        year: 2021,
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
        organizationId: 1,
        projectId: 1,
      });

    expect(result.statusCode).toEqual(201);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    assertGitPOAPRequestCreation(1, 1);
  });
});
