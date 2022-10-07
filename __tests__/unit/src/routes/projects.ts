import { contextMock } from '../../../../__mocks__/src/context';
import { setupApp } from '../../../../src/app';
import { generateAuthTokens } from '../../../../src/lib/authTokens';
import { ADMIN_GITHUB_IDS } from '../../../../src/constants';
import request from 'supertest';
import { createRepoByGithubId } from '../../../../src/lib/repos';
import { backloadGithubPullRequestData } from '../../../../src/lib/pullRequests';

jest.mock('../../../../src/lib/repos');
jest.mock('../../../../src/lib/pullRequests');

const mockedCreateRepoByGithubId = jest.mocked(createRepoByGithubId, true);
const mockedBackloadGithubPullRequestData = jest.mocked(backloadGithubPullRequestData, true);

const authTokenId = 4;
const authTokenGeneration = 0;
const addressId = 45;
const address = '0xfoobar';
const githubId = 232444;
const githubOAuthToken = 'foobar34543';
const githubHandle = 'b-burz';
const projectId = 234;
const githubRepoIds = [2];
const ensName = 'wowza.eth';
const ensAvatarImageUrl = 'https://foobar.com/a.jpg';

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

describe('POST /projects/add-repos', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .post('/projects/add-repos')
      .send({ projectId, githubRepoIds });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with non-admin Access Token provided', async () => {
    mockJwtWithOAuth();

    const authTokens = genAuthTokens(githubId);

    const result = await request(await setupApp())
      .post('/projects/add-repos')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ projectId, githubRepoIds });

    expect(result.statusCode).toEqual(401);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
  });

  it('Returns error when invalid project provided', async () => {
    mockJwtWithOAuth();
    contextMock.prisma.project.findUnique.mockResolvedValue(null);

    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0]);

    const result = await request(await setupApp())
      .post('/projects/add-repos')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ projectId, githubRepoIds });

    expect(result.statusCode).toEqual(404);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: projectId },
      select: { id: true },
    });
  });

  it('Returns error when invalid repos provided', async () => {
    mockJwtWithOAuth();
    contextMock.prisma.project.findUnique.mockResolvedValue({ id: projectId } as any);
    mockedCreateRepoByGithubId.mockResolvedValue(null);

    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0]);

    const result = await request(await setupApp())
      .post('/projects/add-repos')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ projectId, githubRepoIds });

    expect(result.statusCode).toEqual(500);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: projectId },
      select: { id: true },
    });
    expect(mockedCreateRepoByGithubId).toHaveBeenCalledTimes(1);
    expect(mockedCreateRepoByGithubId).toHaveBeenCalledWith(
      githubRepoIds[0],
      projectId,
      githubOAuthToken,
    );
  });

  it('Adds valid repos to valid project with admin JWT', async () => {
    mockJwtWithOAuth();
    contextMock.prisma.project.findUnique.mockResolvedValue({ id: projectId } as any);
    const repoId = 234232;
    mockedCreateRepoByGithubId.mockResolvedValue({ id: repoId } as any);

    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0]);

    const result = await request(await setupApp())
      .post('/projects/add-repos')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ projectId, githubRepoIds });

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: projectId },
      select: { id: true },
    });
    expect(mockedCreateRepoByGithubId).toHaveBeenCalledTimes(1);
    expect(mockedCreateRepoByGithubId).toHaveBeenCalledWith(
      githubRepoIds[0],
      projectId,
      githubOAuthToken,
    );
    expect(mockedBackloadGithubPullRequestData).toHaveBeenCalledTimes(1);
    expect(mockedBackloadGithubPullRequestData).toHaveBeenCalledWith(repoId);
  });
});

describe('PUT /projects/enable/:id', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .put(`/projects/enable/${projectId}`)
      .send();

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with non-admin Access Token provided', async () => {
    mockJwtWithOAuth();

    const authTokens = genAuthTokens(githubId);

    const result = await request(await setupApp())
      .put(`/projects/enable/${projectId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(401);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
  });

  it('Returns a 404 when the Project is not found', async () => {
    mockJwtWithOAuth();
    contextMock.prisma.project.findUnique.mockResolvedValue(null);

    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0]);

    const result = await request(await setupApp())
      .put(`/projects/enable/${projectId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(404);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: projectId },
      select: { id: true },
    });
  });

  it('Enables all GitPOAPs when the Project is found', async () => {
    mockJwtWithOAuth();
    contextMock.prisma.project.findUnique.mockResolvedValue({ id: projectId } as any);

    const authTokens = genAuthTokens(ADMIN_GITHUB_IDS[0]);

    const result = await request(await setupApp())
      .put(`/projects/enable/${projectId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: projectId },
      select: { id: true },
    });

    expect(contextMock.prisma.gitPOAP.updateMany).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAP.updateMany).toHaveBeenCalledWith({
      where: { projectId },
      data: { isEnabled: true },
    });
  });
});
