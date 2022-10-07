import { AdminApprovalStatus, GitPOAPType } from '@prisma/client';
import { contextMock } from '../../../../../__mocks__/src/context';
import { setupApp } from '../../../../../src/app';
import { generateAuthTokens } from '../../../../../src/lib/authTokens';
import { ADMIN_GITHUB_IDS } from '../../../../../src/constants';
import request from 'supertest';
import { getImageBufferFromS3 } from '../../../../../src/external/s3';

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

jest.mock('../../../../../src/external/s3');
jest.mock('../../../../../src/lib/secrets', () => ({
  generatePOAPSecret: jest.fn().mockReturnValue('123423123'),
}));

jest.mock('../../../../../src/external/poap', () => ({
  createPOAPEvent: jest
    .fn()
    .mockResolvedValue({ id: 1, image_url: 'https://poap.xyz', poapEventId: 1 }),
}));

const mockedGetImageBufferFromS3 = jest.mocked(getImageBufferFromS3, true);

function mockJwtWithOAuth() {
  contextMock.prisma.authToken.findUnique.mockResolvedValue({
    user: { githubOAuthToken },
  } as any);
}

function genAuthTokens(someGithubId: number) {
  return generateAuthTokens(
    authTokenId,
    authTokenGeneration,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    someGithubId,
    githubHandle,
  );
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
    const authTokens = genAuthTokens(githubId);
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
    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0]);

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
    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0]);

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
    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0]);

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

    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0]);

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
    const authTokens = genAuthTokens(githubId);
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
    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0]);

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

    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0]);

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
