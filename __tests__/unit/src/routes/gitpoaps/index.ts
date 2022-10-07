import { contextMock } from '../../../../../__mocks__/src/context';
import { setupApp } from '../../../../../src/app';
import { generateAuthTokens } from '../../../../../src/lib/authTokens';
import { ADMIN_GITHUB_IDS } from '../../../../../src/constants';
import request from 'supertest';
import { createRepoByGithubId } from '../../../../../src/lib/repos';
import { backloadGithubPullRequestData } from '../../../../../src/lib/pullRequests';
import { ClaimStatus, GitPOAPStatus } from '@prisma/client';

jest.mock('../../../../../src/lib/repos');
jest.mock('../../../../../src/lib/pullRequests');

jest.mocked(createRepoByGithubId, true);
jest.mocked(backloadGithubPullRequestData, true);

const authTokenId = 4;
const authTokenGeneration = 1;
const addressId = 342;
const address = '0xburzistheword';
const githubId = 232444;
const githubOAuthToken = 'foobar34543';
const githubHandle = 'anna-burz';
const gitPOAPId = 24;
const ensName = 'furby.eth';
const ensAvatarImageUrl = null;

function mockJwtWithOAuth() {
  contextMock.prisma.authToken.findUnique.mockResolvedValue({
    address: { ensName, ensAvatarImageUrl },
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

describe('PUT /gitpoaps/enable/:id', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .put(`/gitpoaps/enable/${gitPOAPId}`)
      .send();

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with non-admin Access Token provided', async () => {
    mockJwtWithOAuth();

    const authTokens = genAuthTokens(githubId);

    const result = await request(await setupApp())
      .put(`/gitpoaps/enable/${gitPOAPId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(401);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
  });

  it('Returns a 404 when the GitPOAP is not found', async () => {
    mockJwtWithOAuth();
    contextMock.prisma.gitPOAP.findUnique.mockResolvedValue(null);

    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0]);

    const result = await request(await setupApp())
      .put(`/gitpoaps/enable/${gitPOAPId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(404);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAP.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAP.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPId },
      select: {
        id: true,
        poapApprovalStatus: true,
      },
    });
  });

  it('Enables valid GitPOAPs', async () => {
    mockJwtWithOAuth();
    contextMock.prisma.gitPOAP.findUnique.mockResolvedValue({ id: gitPOAPId } as any);

    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0]);

    const result = await request(await setupApp())
      .put(`/gitpoaps/enable/${gitPOAPId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAP.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAP.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPId },
      select: {
        id: true,
        poapApprovalStatus: true,
      },
    });

    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledWith({
      where: { id: gitPOAPId },
      data: { isEnabled: true },
    });
  });
});

describe('PUT /gitpoaps/deprecate/:id', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .put(`/gitpoaps/deprecate/${gitPOAPId}`)
      .send();

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with non-admin Access Token provided', async () => {
    mockJwtWithOAuth();

    const authTokens = genAuthTokens(githubId);

    const result = await request(await setupApp())
      .put(`/gitpoaps/deprecate/${gitPOAPId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(401);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
  });

  it('Returns a 404 when the GitPOAP is not found', async () => {
    mockJwtWithOAuth();
    contextMock.prisma.gitPOAP.findUnique.mockResolvedValue(null);

    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0]);

    const result = await request(await setupApp())
      .put(`/gitpoaps/deprecate/${gitPOAPId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(404);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAP.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAP.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPId },
      select: { id: true },
    });
  });

  it('DEPRECATES valid GitPOAPs and deletes unclaimed claims', async () => {
    mockJwtWithOAuth();
    contextMock.prisma.gitPOAP.findUnique.mockResolvedValue({ id: gitPOAPId } as any);

    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0]);

    const result = await request(await setupApp())
      .put(`/gitpoaps/deprecate/${gitPOAPId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAP.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAP.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPId },
      select: { id: true },
    });

    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledWith({
      where: { id: gitPOAPId },
      data: {
        ongoing: false,
        poapApprovalStatus: GitPOAPStatus.DEPRECATED,
      },
    });

    expect(contextMock.prisma.claim.deleteMany).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.claim.deleteMany).toHaveBeenCalledWith({
      where: {
        gitPOAPId,
        status: ClaimStatus.UNCLAIMED,
      },
    });
  });
});
