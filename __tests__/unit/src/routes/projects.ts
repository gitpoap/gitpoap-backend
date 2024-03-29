import '../../../../__mocks__/src/logging';
import { contextMock } from '../../../../__mocks__/src/context';
import { setupApp } from '../../../../__mocks__/src/app';
import { generateAuthTokens } from '../../../../src/lib/authTokens';
import { STAFF_ADDRESSES, STAFF_GITHUB_IDS } from '../../../../src/constants';
import request from 'supertest';
import { createRepoByGithubId } from '../../../../src/lib/repos';
import { backloadGithubPullRequestData } from '../../../../src/lib/pullRequests';
import { ADDRESSES } from '../../../../prisma/constants';
import { DiscordPayload, GithubPayload } from '../../../../src/types/authTokens';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/lib/repos');
jest.mock('../../../../src/lib/pullRequests');

const mockedCreateRepoByGithubId = jest.mocked(createRepoByGithubId, true);
const mockedBackloadGithubPullRequestData = jest.mocked(backloadGithubPullRequestData, true);

const privyUserId = 'hi hi';
const addressId = 45;
const address = ADDRESSES.vitalik;
const githubId = 232444;
const githubHandle = 'b-burz';
const discordHandle = 'tyler#2342';
const projectId = 234;
const githubRepoIds = [2];
const ensName = 'wowza.eth';
const ensAvatarImageUrl = 'https://foobar.com/a.jpg';

function genAuthTokens(
  someAddress?: string,
  someGithubId?: number,
  someGithubHandle?: string,
  someDiscordId?: string,
  someDiscordHandle?: string,
) {
  let github: GithubPayload | null = null;
  if (someGithubId !== undefined && someGithubHandle !== undefined) {
    github = {
      id: 1,
      githubId: someGithubId,
      githubHandle: someGithubHandle,
    };
  }

  let discord: DiscordPayload | null = null;
  if (someDiscordId !== undefined && someDiscordHandle !== undefined) {
    discord = {
      id: 1,
      discordId: someDiscordId,
      discordHandle: someDiscordHandle,
    };
  }

  return generateAuthTokens(
    privyUserId,
    {
      // Address
      id: addressId,
      ethAddress: someAddress ?? address,
      ensName,
      ensAvatarImageUrl,
    },
    github,
    null, // email
    discord,
    [], // memberships
  );
}

describe('POST /projects/add-repos', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .post('/projects/add-repos')
      .send({ projectId, githubRepoIds });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with non-staff OAuth Access Token provided', async () => {
    const authTokens = genAuthTokens(address, githubId, githubHandle, discordHandle);

    const result = await request(await setupApp())
      .post('/projects/add-repos')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ projectId, githubRepoIds });

    expect(result.statusCode).toEqual(401);
  });

  it('Returns error when invalid project provided', async () => {
    contextMock.prisma.project.findUnique.mockResolvedValue(null);

    const authTokens = genAuthTokens(
      STAFF_ADDRESSES[0],
      STAFF_GITHUB_IDS[0],
      githubHandle,
      discordHandle,
    );

    const result = await request(await setupApp())
      .post('/projects/add-repos')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ projectId, githubRepoIds });

    expect(result.statusCode).toEqual(404);

    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: projectId },
      select: { id: true },
    });
  });

  it('Returns error when invalid repos provided', async () => {
    contextMock.prisma.project.findUnique.mockResolvedValue({ id: projectId } as any);
    mockedCreateRepoByGithubId.mockResolvedValue(null);

    const authTokens = genAuthTokens(
      STAFF_ADDRESSES[0],
      STAFF_GITHUB_IDS[0],
      githubHandle,
      discordHandle,
    );

    const result = await request(await setupApp())
      .post('/projects/add-repos')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ projectId, githubRepoIds });

    expect(result.statusCode).toEqual(500);

    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: projectId },
      select: { id: true },
    });
    expect(mockedCreateRepoByGithubId).toHaveBeenCalledTimes(1);
    expect(mockedCreateRepoByGithubId).toHaveBeenCalledWith(githubRepoIds[0], projectId);
  });

  it('Adds valid repos to valid project with staff JWT', async () => {
    contextMock.prisma.project.findUnique.mockResolvedValue({ id: projectId } as any);
    const repoId = 234232;
    mockedCreateRepoByGithubId.mockResolvedValue({ id: repoId } as any);

    const authTokens = genAuthTokens(
      STAFF_ADDRESSES[0],
      STAFF_GITHUB_IDS[0],
      githubHandle,
      discordHandle,
    );

    const result = await request(await setupApp())
      .post('/projects/add-repos')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ projectId, githubRepoIds });

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: projectId },
      select: { id: true },
    });
    expect(mockedCreateRepoByGithubId).toHaveBeenCalledTimes(1);
    expect(mockedCreateRepoByGithubId).toHaveBeenCalledWith(githubRepoIds[0], projectId);
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

  it('Fails with non-staff Access Token provided', async () => {
    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .put(`/projects/enable/${projectId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(401);
  });

  it('Returns a 404 when the Project is not found', async () => {
    contextMock.prisma.project.findUnique.mockResolvedValue(null);

    const authTokens = genAuthTokens(STAFF_ADDRESSES[0]);

    const result = await request(await setupApp())
      .put(`/projects/enable/${projectId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(404);

    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: projectId },
      select: { id: true },
    });
  });

  it('Enables all GitPOAPs when the Project is found', async () => {
    contextMock.prisma.project.findUnique.mockResolvedValue({ id: projectId } as any);

    const authTokens = genAuthTokens(STAFF_ADDRESSES[0]);

    const result = await request(await setupApp())
      .put(`/projects/enable/${projectId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(200);

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
