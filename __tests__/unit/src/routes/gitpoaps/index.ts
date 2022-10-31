import '../../../../../__mocks__/src/logging';
import { contextMock } from '../../../../../__mocks__/src/context';
import { setupApp } from '../../../../../src/app';
import { generateAuthTokens } from '../../../../../src/lib/authTokens';
import { ADMIN_ADDRESSES } from '../../../../../src/constants';
import request from 'supertest';
import { ClaimStatus, GitPOAPStatus } from '@prisma/client';
import { ADDRESSES } from '../../../../../prisma/constants';

jest.mock('../../../../../src/logging');
jest.mock('../../../../../src/lib/repos');
jest.mock('../../../../../src/lib/pullRequests');

const authTokenId = 4;
const authTokenGeneration = 1;
const addressId = 342;
const address = ADDRESSES.vitalik;
const gitPOAPId = 24;
const ensName = 'furby.eth';
const ensAvatarImageUrl = null;

function mockJwtWithAddress() {
  contextMock.prisma.authToken.findUnique.mockResolvedValue({
    id: authTokenId,
    address: { ensName, ensAvatarImageUrl },
  } as any);
}

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

describe('PUT /gitpoaps/enable/:id', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .put(`/gitpoaps/enable/${gitPOAPId}`)
      .send();

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with non-admin Access Token provided', async () => {
    mockJwtWithAddress();

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .put(`/gitpoaps/enable/${gitPOAPId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(401);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
  });

  it('Returns a 404 when the GitPOAP is not found', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAP.findUnique.mockResolvedValue(null);

    const authTokens = genAuthTokens(ADMIN_ADDRESSES[0]);

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
    mockJwtWithAddress();
    contextMock.prisma.gitPOAP.findUnique.mockResolvedValue({ id: gitPOAPId } as any);

    const authTokens = genAuthTokens(ADMIN_ADDRESSES[0]);

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
    mockJwtWithAddress();

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .put(`/gitpoaps/deprecate/${gitPOAPId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(401);

    expect(contextMock.prisma.authToken.findUnique).toHaveBeenCalledTimes(1);
  });

  it('Returns a 404 when the GitPOAP is not found', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAP.findUnique.mockResolvedValue(null);

    const authTokens = genAuthTokens(ADMIN_ADDRESSES[0]);

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
    mockJwtWithAddress();
    contextMock.prisma.gitPOAP.findUnique.mockResolvedValue({ id: gitPOAPId } as any);

    const authTokens = genAuthTokens(ADMIN_ADDRESSES[0]);

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
