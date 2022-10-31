import { mockDeep } from 'jest-mock-extended';
import { Multer } from 'multer';
import '../../../../../__mocks__/src/logging';
import { contextMock } from '../../../../../__mocks__/src/context';
import { AdminApprovalStatus, ClaimStatus, GitPOAPType } from '@prisma/client';
import { setupApp } from '../../../../../src/app';
import { generateAuthTokens } from '../../../../../src/lib/authTokens';
import request from 'supertest';
import {
  getImageBufferFromS3,
  S3ClientConfigProfile,
  uploadMulterFile,
} from '../../../../../src/external/s3';
import { DateTime } from 'luxon';
import { ADMIN_GITHUB_IDS } from '../../../../../src/constants';
import { ADDRESSES, GH_HANDLES } from '../../../../../prisma/constants';
import {
  createClaimForEmail,
  createClaimForEnsName,
  createClaimForEthAddress,
  createClaimForGithubHandle,
} from '../../../../../src/lib/claims';

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
const claimId = 342;
const burzEmail = 'burz@gitpoap.io';
const burzENS = 'burz.eth';
const colfaxEmail = 'colfax@gitpoap.io';
const colfaxENS = 'colfax.eth';

const baseGitPOAP = {
  name: 'foobar-name',
  description: 'foobar-description',
  startDate: '2021-01-01',
  endDate: '2021-01-10',
  expiryDate: '2023-01-01',
  eventUrl: 'https://foobar.com',
  email: 'jay@gitpoap.io',
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
};
const claim = {
  id: claimId,
  status: ClaimStatus.UNCLAIMED,
  gitPOAP: {
    id: gitPOAPId,
    type: GitPOAPType.CUSTOM,
    gitPOAPRequest: {
      addressId,
    },
  },
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

jest.mock('../../../../../src/lib/claims');
const mockedCreateClaimForEmail = jest.mocked(createClaimForEmail, true);
const mockedCreateClaimForEnsName = jest.mocked(createClaimForEnsName, true);
const mockedCreateClaimForEthAddress = jest.mocked(createClaimForEthAddress, true);
const mockedCreateClaimForGithubHandle = jest.mocked(createClaimForGithubHandle, true);

jest.spyOn(DateTime, 'now').mockReturnValue(DateTime.fromSeconds(123456789));
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

  it('Returns 200 if the GitPOAP Request is already approved', async () => {
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

    expect(result.statusCode).toEqual(200);
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
      imageKey: 'foobar_imgKey-123456789',
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

  it('Fails and returns a 404 when the GitPOAP Request is not found', async () => {
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

  it('Fails and returns 400 when the GitPOAP Request is already approved', async () => {
    mockJwtWithOAuth();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.APPROVED,
      description: 'foobar',
      imageKey: 'foobar_imgKey-123456789',
      isEnabled: true,
      isPRBased: false,
      name: 'foobar',
      ongoing: true,
      year: 2021,
    } as any);
    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0], githubHandle);

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
    mockJwtWithOAuth();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.REJECTED,
      description: 'foobar',
      imageKey: 'foobar_imgKey-123456789',
      isEnabled: true,
      isPRBased: false,

      name: 'foobar',
      ongoing: true,
      year: 2021,
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
  });

  it('Updates the GitPOAP Request status in the DB to be REJECTED', async () => {
    mockJwtWithOAuth();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      id: gitPOAPRequestId,
      type: GitPOAPType.CUSTOM,
      adminApprovalStatus: AdminApprovalStatus.PENDING,
      description: 'foobar',
      imageKey: 'foobar_imgKey-123456789',
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
  const assertGitPOAPRequestCreation = (orgId?: number, projectId?: number) => {
    expect(contextMock.prisma.gitPOAPRequest.create).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAPRequest.create).toHaveBeenCalledWith({
      data: {
        name: 'foobar-name',
        description: 'foobar-description',
        imageKey: 'foobar.png-123456789',
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
        address: { connect: { id: addressId } },
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
      'foobar.png-123456789',
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
        ...baseGitPOAP,
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
        ...baseGitPOAP,
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
        ...baseGitPOAP,
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

    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .post('/gitpoaps/custom')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ ...baseGitPOAP });

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
        ...baseGitPOAP,
        organizationId: '1',
        projectId: '1',
      });

    expect(result.statusCode).toEqual(201);
    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    assertGitPOAPRequestCreation(1, 1);
  });
});

describe('DELETE /gitpoaps/custom/claim/:id', () => {
  it('Fails with no Access Token provided', async () => {
    contextMock.prisma.claim.findUnique.mockResolvedValue(null);
    const result = await request(await setupApp())
      .delete(`/gitpoaps/custom/claim/${claimId}`)
      .send();

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(0);
  });

  const expectFindUniqueCalls = (count: number = 1) => {
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(count);
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledWith({
      where: { id: claimId },
      select: {
        status: true,
        gitPOAP: {
          select: {
            id: true,
            type: true,
            gitPOAPRequest: {
              select: {
                addressId: true,
              },
            },
          },
        },
      },
    });
  };

  it('Succeeds if the claim is already deleted', async () => {
    mockJwtWithAddress();
    contextMock.prisma.claim.findUnique.mockResolvedValue(null);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .delete(`/gitpoaps/custom/claim/${claimId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(200);

    expectFindUniqueCalls();
  });

  it('Fails if the claim is not CUSTOM', async () => {
    mockJwtWithAddress();
    contextMock.prisma.claim.findUnique.mockResolvedValue({
      gitPOAP: { type: GitPOAPType.ANNUAL },
    } as any);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .delete(`/gitpoaps/custom/claim/${claimId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(400);

    expectFindUniqueCalls();
  });

  it('Fails if the GitPOAPRequest does not exist', async () => {
    mockJwtWithAddress();
    contextMock.prisma.claim.findUnique.mockResolvedValue({
      gitPOAP: {
        type: GitPOAPType.CUSTOM,
        gitPOAPRequest: null,
      },
    } as any);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .delete(`/gitpoaps/custom/claim/${claimId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(500);

    expectFindUniqueCalls();
  });

  it('Fails if the caller is not the owner', async () => {
    mockJwtWithAddress();
    contextMock.prisma.claim.findUnique.mockResolvedValue({
      gitPOAP: {
        type: GitPOAPType.CUSTOM,
        gitPOAPRequest: { addressId: addressId + 2 },
      },
    } as any);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .delete(`/gitpoaps/custom/claim/${claimId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(401);

    expectFindUniqueCalls();
  });

  it('Fails if the Claim is not UNCLAIMED', async () => {
    mockJwtWithAddress();
    const authTokens = genAuthTokens();

    const testClaimStatusValue = async (status: ClaimStatus) => {
      contextMock.prisma.claim.findUnique.mockResolvedValueOnce({
        status,
        gitPOAP: {
          type: GitPOAPType.CUSTOM,
          gitPOAPRequest: { addressId },
        },
      } as any);
      const result = await request(await setupApp())
        .delete(`/gitpoaps/custom/claim/${claimId}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send();
      expect(result.statusCode).toEqual(400);
    };

    await testClaimStatusValue(ClaimStatus.PENDING);
    await testClaimStatusValue(ClaimStatus.MINTING);
    await testClaimStatusValue(ClaimStatus.CLAIMED);

    expectFindUniqueCalls(3);
  });

  it('Succeeds if Claim is UNCLAIMED', async () => {
    mockJwtWithAddress();
    contextMock.prisma.claim.findUnique.mockResolvedValue(claim as any);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .delete(`/gitpoaps/custom/claim/${claimId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(200);

    expectFindUniqueCalls();

    expect(contextMock.prisma.claim.deleteMany).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.claim.deleteMany).toHaveBeenCalledWith({
      where: { id: claimId },
    });
  });
});

describe('DELETE /gitpoaps/custom/:gitPOAPRequestId/claim', () => {
  it('Fails with no Access Token provided', async () => {
    contextMock.prisma.claim.findUnique.mockResolvedValue(null);
    const result = await request(await setupApp())
      .delete(`/gitpoaps/custom/${gitPOAPRequestId}/claim`)
      .send({ claimType: 'githubHandle', claimData: GH_HANDLES.burz });

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(0);
  });

  it('Fails with invalid body', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(null);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .delete(`/gitpoaps/custom/${gitPOAPRequestId}/claim`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ claimData: GH_HANDLES.burz });

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(0);
  });

  it('Fails with invalid claimType', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(null);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .delete(`/gitpoaps/custom/${gitPOAPRequestId}/claim`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ claimType: 'foobar', claimData: GH_HANDLES.burz });

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(0);
  });

  const expectFindUniqueCalls = (count: number = 1) => {
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(count);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
      select: {
        addressId: true,
        adminApprovalStatus: true,
        contributors: true,
      },
    });
  };

  it('Fails when GitPOAPRequest not found', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(null);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .delete(`/gitpoaps/custom/${gitPOAPRequestId}/claim`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ claimType: 'githubHandle', claimData: GH_HANDLES.burz });

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
      .delete(`/gitpoaps/custom/${gitPOAPRequestId}/claim`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ claimType: 'githubHandle', claimData: GH_HANDLES.burz });

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
      .delete(`/gitpoaps/custom/${gitPOAPRequestId}/claim`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ claimType: 'githubHandle', claimData: GH_HANDLES.burz });

    expect(result.statusCode).toEqual(400);

    expectFindUniqueCalls();
  });

  it('Removes the correct contributor on success', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(gitPOAPRequest as any);
    const authTokens = genAuthTokens();
    {
      const result = await request(await setupApp())
        .delete(`/gitpoaps/custom/${gitPOAPRequestId}/claim`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ claimType: 'githubHandle', claimData: GH_HANDLES.burz });
      expect(result.statusCode).toEqual(200);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(1);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledWith({
        where: { id: gitPOAPRequestId },
        data: {
          contributors: {
            ...gitPOAPRequest.contributors,
            githubHandles: [],
          },
        },
      });
    }
    {
      const result = await request(await setupApp())
        .delete(`/gitpoaps/custom/${gitPOAPRequestId}/claim`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ claimType: 'email', claimData: burzEmail });
      expect(result.statusCode).toEqual(200);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(2);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenLastCalledWith({
        where: { id: gitPOAPRequestId },
        data: {
          contributors: {
            ...gitPOAPRequest.contributors,
            emails: [],
          },
        },
      });
    }
    {
      const result = await request(await setupApp())
        .delete(`/gitpoaps/custom/${gitPOAPRequestId}/claim`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ claimType: 'ethAddress', claimData: ADDRESSES.burz });
      expect(result.statusCode).toEqual(200);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(3);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenLastCalledWith({
        where: { id: gitPOAPRequestId },
        data: {
          contributors: {
            ...gitPOAPRequest.contributors,
            ethAddresses: [],
          },
        },
      });
    }
    {
      const result = await request(await setupApp())
        .delete(`/gitpoaps/custom/${gitPOAPRequestId}/claim`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ claimType: 'ensName', claimData: burzENS });
      expect(result.statusCode).toEqual(200);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(4);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenLastCalledWith({
        where: { id: gitPOAPRequestId },
        data: {
          contributors: {
            ...gitPOAPRequest.contributors,
            ensNames: [],
          },
        },
      });
    }

    expectFindUniqueCalls(4);
  });
});

describe('PUT /gitpoaps/custom/claims', () => {
  it('Fails with no Access Token provided', async () => {
    contextMock.prisma.claim.findUnique.mockResolvedValue(null);
    const result = await request(await setupApp())
      .put('/gitpoaps/custom/claims')
      .send({ githubHandles: GH_HANDLES.colfax });

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(0);
  });

  it('Fails with invalid body', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(null);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .put('/gitpoaps/custom/claims')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ claimData: GH_HANDLES.burz });

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(0);
  });

  const expectFindUniqueCalls = (count: number = 1) => {
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledTimes(count);
    expect(contextMock.prisma.gitPOAPRequest.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPRequestId },
      select: {
        addressId: true,
        adminApprovalStatus: true,
        contributors: true,
        gitPOAP: {
          select: { id: true },
        },
      },
    });
  };

  it('Fails when GitPOAPRequest not found', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(null);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .put('/gitpoaps/custom/claims')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ gitPOAPRequestId, contributors: { githubHandles: [GH_HANDLES.colfax] } });

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
      .put('/gitpoaps/custom/claims')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ gitPOAPRequestId, contributors: { githubHandles: [GH_HANDLES.colfax] } });

    expect(result.statusCode).toEqual(401);

    expectFindUniqueCalls();
  });

  it('Fails when GitPOAPRequest is APPROVED but related GitPOAP is null', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      ...gitPOAPRequest,
      adminApprovalStatus: AdminApprovalStatus.APPROVED,
      gitPOAP: null,
    } as any);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .put('/gitpoaps/custom/claims')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ gitPOAPRequestId, contributors: { githubHandles: [GH_HANDLES.colfax] } });

    expect(result.statusCode).toEqual(500);

    expectFindUniqueCalls();

    expect(mockedCreateClaimForEmail).toHaveBeenCalledTimes(0);
    expect(mockedCreateClaimForEnsName).toHaveBeenCalledTimes(0);
    expect(mockedCreateClaimForEthAddress).toHaveBeenCalledTimes(0);
    expect(mockedCreateClaimForGithubHandle).toHaveBeenCalledTimes(0);
  });

  it('Succeeds when GitPOAPRequest is APPROVED', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue({
      ...gitPOAPRequest,
      adminApprovalStatus: AdminApprovalStatus.APPROVED,
    } as any);
    const authTokens = genAuthTokens();
    {
      const result = await request(await setupApp())
        .put('/gitpoaps/custom/claims')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ gitPOAPRequestId, contributors: { githubHandles: [GH_HANDLES.colfax] } });
      expect(result.statusCode).toEqual(200);
      expect(mockedCreateClaimForEmail).toHaveBeenCalledTimes(0);
      expect(mockedCreateClaimForEnsName).toHaveBeenCalledTimes(0);
      expect(mockedCreateClaimForEthAddress).toHaveBeenCalledTimes(0);
      expect(mockedCreateClaimForGithubHandle).toHaveBeenCalledTimes(1);
      expect(mockedCreateClaimForGithubHandle).toHaveBeenCalledWith(GH_HANDLES.colfax, gitPOAPId);
    }
    {
      const result = await request(await setupApp())
        .put('/gitpoaps/custom/claims')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ gitPOAPRequestId, contributors: { emails: [colfaxEmail] } });
      expect(result.statusCode).toEqual(200);
      expect(mockedCreateClaimForEmail).toHaveBeenCalledTimes(1);
      expect(mockedCreateClaimForEmail).toHaveBeenCalledWith(colfaxEmail, gitPOAPId);
      expect(mockedCreateClaimForEnsName).toHaveBeenCalledTimes(0);
      expect(mockedCreateClaimForEthAddress).toHaveBeenCalledTimes(0);
      expect(mockedCreateClaimForGithubHandle).toHaveBeenCalledTimes(1);
    }
    {
      const result = await request(await setupApp())
        .put('/gitpoaps/custom/claims')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ gitPOAPRequestId, contributors: { ethAddresses: [ADDRESSES.colfax] } });
      expect(result.statusCode).toEqual(200);
      expect(mockedCreateClaimForEmail).toHaveBeenCalledTimes(1);
      expect(mockedCreateClaimForEnsName).toHaveBeenCalledTimes(0);
      expect(mockedCreateClaimForEthAddress).toHaveBeenCalledTimes(1);
      expect(mockedCreateClaimForEthAddress).toHaveBeenCalledWith(ADDRESSES.colfax, gitPOAPId);
      expect(mockedCreateClaimForGithubHandle).toHaveBeenCalledTimes(1);
    }
    {
      const result = await request(await setupApp())
        .put('/gitpoaps/custom/claims')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ gitPOAPRequestId, contributors: { ensNames: [colfaxENS] } });
      expect(result.statusCode).toEqual(200);
      expect(mockedCreateClaimForEmail).toHaveBeenCalledTimes(1);
      expect(mockedCreateClaimForEnsName).toHaveBeenCalledTimes(1);
      expect(mockedCreateClaimForEnsName).toHaveBeenCalledWith(colfaxENS, gitPOAPId);
      expect(mockedCreateClaimForEthAddress).toHaveBeenCalledTimes(1);
      expect(mockedCreateClaimForGithubHandle).toHaveBeenCalledTimes(1);
    }

    expectFindUniqueCalls(4);
  });

  it('Succeeds when GitPOAPRequest is not APPROVED', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(gitPOAPRequest as any);
    const authTokens = genAuthTokens();
    {
      const result = await request(await setupApp())
        .put('/gitpoaps/custom/claims')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ gitPOAPRequestId, contributors: { githubHandles: [GH_HANDLES.colfax] } });
      expect(result.statusCode).toEqual(200);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(1);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledWith({
        where: { id: gitPOAPRequestId },
        data: {
          contributors: {
            ...gitPOAPRequest.contributors,
            githubHandles: [GH_HANDLES.burz, GH_HANDLES.colfax],
          },
        },
      });
    }
    {
      const result = await request(await setupApp())
        .put('/gitpoaps/custom/claims')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ gitPOAPRequestId, contributors: { emails: [colfaxEmail] } });
      expect(result.statusCode).toEqual(200);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(2);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenLastCalledWith({
        where: { id: gitPOAPRequestId },
        data: {
          contributors: {
            ...gitPOAPRequest.contributors,
            emails: [burzEmail, colfaxEmail],
          },
        },
      });
    }
    {
      const result = await request(await setupApp())
        .put('/gitpoaps/custom/claims')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ gitPOAPRequestId, contributors: { ethAddresses: [ADDRESSES.colfax] } });
      expect(result.statusCode).toEqual(200);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(3);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenLastCalledWith({
        where: { id: gitPOAPRequestId },
        data: {
          contributors: {
            ...gitPOAPRequest.contributors,
            ethAddresses: [ADDRESSES.burz, ADDRESSES.colfax],
          },
        },
      });
    }
    {
      const result = await request(await setupApp())
        .put('/gitpoaps/custom/claims')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ gitPOAPRequestId, contributors: { ensNames: [colfaxENS] } });
      expect(result.statusCode).toEqual(200);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenCalledTimes(4);
      expect(contextMock.prisma.gitPOAPRequest.update).toHaveBeenLastCalledWith({
        where: { id: gitPOAPRequestId },
        data: {
          contributors: {
            ...gitPOAPRequest.contributors,
            ensNames: [burzENS, colfaxENS],
          },
        },
      });
    }

    expectFindUniqueCalls(4);
  });
});
