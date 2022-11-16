import '../../../../../__mocks__/src/logging';
import { contextMock } from '../../../../../__mocks__/src/context';
import { setupApp } from '../../../../../__mocks__/src/app';
import { generateAuthTokens } from '../../../../../src/lib/authTokens';
import { ADMIN_ADDRESSES } from '../../../../../src/constants';
import request from 'supertest';
import { ClaimStatus, GitPOAPStatus, GitPOAPType } from '@prisma/client';
import { ADDRESSES, GH_HANDLES } from '../../../../../prisma/constants';
import { UserAuthTokens } from '../../../../../src/types/authTokens';
import {
  createClaimForEmail,
  createClaimForEnsName,
  createClaimForEthAddress,
  createClaimForGithubHandle,
  ensureRedeemCodeThreshold,
} from '../../../../../src/lib/claims';

jest.mock('../../../../../src/logging');
jest.mock('../../../../../src/lib/repos');
jest.mock('../../../../../src/lib/pullRequests');
jest.mock('../../../../../src/lib/claims');

const mockedCreateClaimForEmail = jest.mocked(createClaimForEmail, true);
const mockedCreateClaimForEnsName = jest.mocked(createClaimForEnsName, true);
const mockedCreateClaimForEthAddress = jest.mocked(createClaimForEthAddress, true);
const mockedCreateClaimForGithubHandle = jest.mocked(createClaimForGithubHandle, true);
const mockedEnsureRedeemCodeThreshold = jest.mocked(ensureRedeemCodeThreshold, true);

const authTokenId = 4;
const authTokenGeneration = 1;
const addressId = 342;
const address = ADDRESSES.vitalik;
const gitPOAPId = 24;
const ensName = 'furby.eth';
const ensAvatarImageUrl = null;
const colfaxEmail = 'colfax@gitpoap.io';
const colfaxENS = 'colfax.eth';

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

describe('PUT /gitpoaps/:gitPOAPId/claims', () => {
  it('Fails with no Access Token provided', async () => {
    contextMock.prisma.claim.findUnique.mockResolvedValue(null);
    const result = await request(await setupApp())
      .put(`/gitpoaps/${gitPOAPId}/claims`)
      .send({ githubHandles: GH_HANDLES.colfax });

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.gitPOAP.findUnique).toHaveBeenCalledTimes(0);
  });

  it('Fails with invalid body', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAP.findUnique.mockResolvedValue(null);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .put(`/gitpoaps/${gitPOAPId}/claims`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ claimData: GH_HANDLES.burz });

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.gitPOAP.findUnique).toHaveBeenCalledTimes(0);
  });

  const expectFindUniqueCalls = (count = 1) => {
    expect(contextMock.prisma.gitPOAP.findUnique).toHaveBeenCalledTimes(count);
    expect(contextMock.prisma.gitPOAP.findUnique).toHaveBeenCalledWith({
      where: { id: gitPOAPId },
      select: {
        creatorAddressId: true,
        id: true,
        ongoing: true,
        poapApprovalStatus: true,
        poapEventId: true,
        poapSecret: true,
        type: true,
      },
    });
  };

  it('Fails when GitPOAP is not found', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAP.findUnique.mockResolvedValue(null);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .put(`/gitpoaps/${gitPOAPId}/claims`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ contributors: { githubHandles: [GH_HANDLES.colfax] } });

    expect(result.statusCode).toEqual(404);

    expectFindUniqueCalls();
  });

  it('Fails when user is not the owner of CUSTOM GitPOAP', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAP.findUnique.mockResolvedValue({
      type: GitPOAPType.CUSTOM,
      creatorAddressId: addressId + 2,
    } as any);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .put(`/gitpoaps/${gitPOAPId}/claims`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ contributors: { githubHandles: [GH_HANDLES.colfax] } });

    expect(result.statusCode).toEqual(401);

    expectFindUniqueCalls();
  });

  it('Fails when user is not an admin for non-CUSTOM GitPOAPs', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAP.findUnique.mockResolvedValue({
      type: GitPOAPType.ANNUAL,
      creatorAddressId: null,
    } as any);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .put(`/gitpoaps/${gitPOAPId}/claims`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ contributors: { githubHandles: [GH_HANDLES.colfax] } });

    expect(result.statusCode).toEqual(401);

    expectFindUniqueCalls();
  });

  const expectSuccessWithAuthTokens = async (authTokens: UserAuthTokens) => {
    {
      const result = await request(await setupApp())
        .put(`/gitpoaps/${gitPOAPId}/claims`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ contributors: { githubHandles: [GH_HANDLES.colfax] } });
      expect(result.statusCode).toEqual(200);
      expect(mockedCreateClaimForEmail).toHaveBeenCalledTimes(0);
      expect(mockedCreateClaimForEnsName).toHaveBeenCalledTimes(0);
      expect(mockedCreateClaimForEthAddress).toHaveBeenCalledTimes(0);
      expect(mockedCreateClaimForGithubHandle).toHaveBeenCalledTimes(1);
      expect(mockedCreateClaimForGithubHandle).toHaveBeenCalledWith(GH_HANDLES.colfax, gitPOAPId);

      expect(mockedEnsureRedeemCodeThreshold).toHaveBeenCalledTimes(1);
    }
    {
      const result = await request(await setupApp())
        .put(`/gitpoaps/${gitPOAPId}/claims`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ contributors: { emails: [colfaxEmail] } });
      expect(result.statusCode).toEqual(200);
      expect(mockedCreateClaimForEmail).toHaveBeenCalledTimes(1);
      expect(mockedCreateClaimForEmail).toHaveBeenCalledWith(colfaxEmail, gitPOAPId);
      expect(mockedCreateClaimForEnsName).toHaveBeenCalledTimes(0);
      expect(mockedCreateClaimForEthAddress).toHaveBeenCalledTimes(0);
      expect(mockedCreateClaimForGithubHandle).toHaveBeenCalledTimes(1);

      expect(mockedEnsureRedeemCodeThreshold).toHaveBeenCalledTimes(2);
    }
    {
      const result = await request(await setupApp())
        .put(`/gitpoaps/${gitPOAPId}/claims`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ contributors: { ethAddresses: [ADDRESSES.colfax] } });
      expect(result.statusCode).toEqual(200);
      expect(mockedCreateClaimForEmail).toHaveBeenCalledTimes(1);
      expect(mockedCreateClaimForEnsName).toHaveBeenCalledTimes(0);
      expect(mockedCreateClaimForEthAddress).toHaveBeenCalledTimes(1);
      expect(mockedCreateClaimForEthAddress).toHaveBeenCalledWith(ADDRESSES.colfax, gitPOAPId);
      expect(mockedCreateClaimForGithubHandle).toHaveBeenCalledTimes(1);

      expect(mockedEnsureRedeemCodeThreshold).toHaveBeenCalledTimes(3);
    }
    {
      const result = await request(await setupApp())
        .put(`/gitpoaps/${gitPOAPId}/claims`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ contributors: { ensNames: [colfaxENS] } });
      expect(result.statusCode).toEqual(200);
      expect(mockedCreateClaimForEmail).toHaveBeenCalledTimes(1);
      expect(mockedCreateClaimForEnsName).toHaveBeenCalledTimes(1);
      expect(mockedCreateClaimForEnsName).toHaveBeenCalledWith(colfaxENS, gitPOAPId);
      expect(mockedCreateClaimForEthAddress).toHaveBeenCalledTimes(1);
      expect(mockedCreateClaimForGithubHandle).toHaveBeenCalledTimes(1);

      expect(mockedEnsureRedeemCodeThreshold).toHaveBeenCalledTimes(4);
    }

    expectFindUniqueCalls(4);
  };

  it('Succeeds for owner of Custom GitPOAP', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAP.findUnique.mockResolvedValue({
      type: GitPOAPType.CUSTOM,
      creatorAddressId: addressId,
    } as any);
    const authTokens = genAuthTokens();

    await expectSuccessWithAuthTokens(authTokens);
  });

  it('Succeeds for admin with non-Custom GitPOAP', async () => {
    mockJwtWithAddress();
    contextMock.prisma.gitPOAP.findUnique.mockResolvedValue({
      type: GitPOAPType.ANNUAL,
      creatorAddressId: null,
    } as any);
    const authTokens = genAuthTokens(ADMIN_ADDRESSES[0]);

    await expectSuccessWithAuthTokens(authTokens);
  });
});
