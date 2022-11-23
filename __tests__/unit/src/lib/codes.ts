import '../../../../__mocks__/src/logging';
import { contextMock } from '../../../../__mocks__/src/context';
import { GitPOAPStatus, GitPOAPType } from '@prisma/client';
import { retrievePOAPCodes } from '../../../../src/external/poap';
import { checkGitPOAPForNewCodesWithApprovalEmail } from '../../../../src/lib/codes';
import { sendGitPOAPRequestLiveEmail } from '../../../../src/external/postmark';
import { getS3URL } from '../../../../src/external/s3';
import { DateTime } from 'luxon';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/external/poap');
jest.mock('../../../../src/external/postmark');

const mockedRetrievePOAPCodes = jest.mocked(retrievePOAPCodes, true);
const mockedSendGitPOAPRequestLiveEmail = jest.mocked(sendGitPOAPRequestLiveEmail, true);

const gitPOAP = {
  id: 34,
  poapApprovalStatus: GitPOAPStatus.UNAPPROVED,
  poapEventId: 32423,
  poapSecret: 'foobar',
  type: GitPOAPType.CUSTOM,
  name: 'foobar',
  description: 'foobar-description',
  organization: {
    id: 1,
    name: 'organization 1',
  },
  imageUrl: getS3URL('gitpoap-request-images-test', 'foobar.png-123456789'),
  creatorEmail: { emailAddress: 'test@gitpoap.io' },
  gitPOAPRequest: {
    startDate: DateTime.fromISO('2021-01-01').toJSDate(),
    endDate: DateTime.fromISO('2021-01-10').toJSDate(),
  },
};
const redeemCodeId = 1;
const redeemCode = 'skjdfl';
const repoIds = [34, 4, 3];

describe('checkGitPOAPForNewCodesWithApprovalEmail', () => {
  const expectCountCodes = (gitPOAPId: number) => {
    expect(contextMock.prisma.redeemCode.count).toHaveBeenCalledWith({
      where: { gitPOAPId },
    });
  };

  it('Should fail if retrieval via POAP API fails', async () => {
    contextMock.prisma.redeemCode.count.mockResolvedValue(10);
    mockedRetrievePOAPCodes.mockResolvedValue(null);

    const returnedRepoIds = await checkGitPOAPForNewCodesWithApprovalEmail(gitPOAP);

    expect(returnedRepoIds).toEqual([]);

    expect(contextMock.prisma.redeemCode.count).toHaveBeenCalledTimes(1);

    expectCountCodes(gitPOAP.id);

    expect(mockedRetrievePOAPCodes).toHaveBeenCalledTimes(1);
    expect(mockedRetrievePOAPCodes).toHaveBeenCalledWith(gitPOAP.poapEventId, gitPOAP.poapSecret);

    expect(contextMock.prisma.redeemCode.findMany).toHaveBeenCalledTimes(0);
  });

  it("Should delete codes that aren't found", async () => {
    contextMock.prisma.redeemCode.count.mockResolvedValue(1);
    mockedRetrievePOAPCodes.mockResolvedValue([]);
    contextMock.prisma.redeemCode.findMany.mockResolvedValue([
      {
        id: redeemCodeId,
        code: redeemCode,
      },
    ] as any);

    const returnedRepoIds = await checkGitPOAPForNewCodesWithApprovalEmail(gitPOAP);

    expect(returnedRepoIds).toEqual([]);

    expect(contextMock.prisma.redeemCode.count).toHaveBeenCalledTimes(2);

    expectCountCodes(gitPOAP.id);

    expect(mockedRetrievePOAPCodes).toHaveBeenCalledTimes(1);
    expect(mockedRetrievePOAPCodes).toHaveBeenCalledWith(gitPOAP.poapEventId, gitPOAP.poapSecret);

    expect(contextMock.prisma.redeemCode.findMany).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.redeemCode.findMany).toHaveBeenCalledWith({
      where: { gitPOAPId: gitPOAP.id },
    });

    expect(contextMock.prisma.redeemCode.upsert).toHaveBeenCalledTimes(0);

    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledTimes(0);

    expect(contextMock.prisma.redeemCode.delete).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.redeemCode.delete).toHaveBeenCalledWith({
      where: { id: redeemCodeId },
    });
  });

  it('Should delete codes that are already claimed', async () => {
    contextMock.prisma.redeemCode.count.mockResolvedValue(1);
    mockedRetrievePOAPCodes.mockResolvedValue([
      {
        qr_hash: redeemCode,
        claimed: true,
      },
    ]);
    contextMock.prisma.redeemCode.findMany.mockResolvedValue([
      {
        id: redeemCodeId,
        code: redeemCode,
      },
    ] as any);

    const returnedRepoIds = await checkGitPOAPForNewCodesWithApprovalEmail(gitPOAP);

    expect(returnedRepoIds).toEqual([]);

    expect(contextMock.prisma.redeemCode.count).toHaveBeenCalledTimes(2);

    expectCountCodes(gitPOAP.id);

    expect(mockedRetrievePOAPCodes).toHaveBeenCalledTimes(1);
    expect(mockedRetrievePOAPCodes).toHaveBeenCalledWith(gitPOAP.poapEventId, gitPOAP.poapSecret);

    expect(contextMock.prisma.redeemCode.findMany).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.redeemCode.findMany).toHaveBeenCalledWith({
      where: { gitPOAPId: gitPOAP.id },
    });

    expect(contextMock.prisma.redeemCode.upsert).toHaveBeenCalledTimes(0);

    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledTimes(0);

    expect(contextMock.prisma.redeemCode.delete).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.redeemCode.delete).toHaveBeenCalledWith({
      where: { id: redeemCodeId },
    });
  });

  it('Should do nothing when the count is unchanged', async () => {
    contextMock.prisma.redeemCode.count.mockResolvedValue(1);
    mockedRetrievePOAPCodes.mockResolvedValue([
      {
        qr_hash: redeemCode,
        claimed: false,
      },
    ]);
    contextMock.prisma.redeemCode.findMany.mockResolvedValue([
      {
        id: redeemCodeId,
        code: redeemCode,
      },
    ] as any);

    const returnedRepoIds = await checkGitPOAPForNewCodesWithApprovalEmail(gitPOAP);

    expect(returnedRepoIds).toEqual([]);

    expect(contextMock.prisma.redeemCode.count).toHaveBeenCalledTimes(2);

    expectCountCodes(gitPOAP.id);

    expect(mockedRetrievePOAPCodes).toHaveBeenCalledTimes(1);
    expect(mockedRetrievePOAPCodes).toHaveBeenCalledWith(gitPOAP.poapEventId, gitPOAP.poapSecret);

    expect(contextMock.prisma.redeemCode.findMany).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.redeemCode.findMany).toHaveBeenCalledWith({
      where: { gitPOAPId: gitPOAP.id },
    });

    expect(contextMock.prisma.redeemCode.upsert).toHaveBeenCalledTimes(0);

    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledTimes(0);

    expect(contextMock.prisma.redeemCode.delete).toHaveBeenCalledTimes(0);

    expect(mockedSendGitPOAPRequestLiveEmail).toHaveBeenCalledTimes(0);
  });

  // Handles the case where a user mints while the process is running
  it('Should do nothing when the count is less', async () => {
    contextMock.prisma.redeemCode.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    mockedRetrievePOAPCodes.mockResolvedValue([
      {
        qr_hash: redeemCode,
        claimed: false,
      },
    ]);
    contextMock.prisma.redeemCode.findMany.mockResolvedValue([
      {
        id: redeemCodeId,
        code: redeemCode,
      },
    ] as any);

    const returnedRepoIds = await checkGitPOAPForNewCodesWithApprovalEmail(gitPOAP);

    expect(returnedRepoIds).toEqual([]);

    expect(contextMock.prisma.redeemCode.count).toHaveBeenCalledTimes(2);

    expectCountCodes(gitPOAP.id);

    expect(mockedRetrievePOAPCodes).toHaveBeenCalledTimes(1);
    expect(mockedRetrievePOAPCodes).toHaveBeenCalledWith(gitPOAP.poapEventId, gitPOAP.poapSecret);

    expect(contextMock.prisma.redeemCode.findMany).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.redeemCode.findMany).toHaveBeenCalledWith({
      where: { gitPOAPId: gitPOAP.id },
    });

    expect(contextMock.prisma.redeemCode.upsert).toHaveBeenCalledTimes(0);

    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledTimes(0);

    expect(contextMock.prisma.redeemCode.delete).toHaveBeenCalledTimes(0);

    expect(mockedSendGitPOAPRequestLiveEmail).toHaveBeenCalledTimes(0);
  });

  const mockLookupRepoIds = () => {
    contextMock.prisma.gitPOAP.findUnique.mockResolvedValue({
      project: { repos: repoIds.map(id => ({ id })) },
    } as any);
  };

  const expectUpsertRedeemCode = () => {
    expect(contextMock.prisma.redeemCode.upsert).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.redeemCode.upsert).toHaveBeenCalledWith({
      where: {
        gitPOAPId_code: {
          gitPOAPId: gitPOAP.id,
          code: redeemCode,
        },
      },
      update: {},
      create: {
        gitPOAP: {
          connect: { id: gitPOAP.id },
        },
        code: redeemCode,
      },
    });
  };

  it('Should update the status of the GitPOAP after receiving more codes', async () => {
    contextMock.prisma.redeemCode.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    mockedRetrievePOAPCodes.mockResolvedValue([
      {
        qr_hash: redeemCode,
        claimed: false,
      },
    ]);
    contextMock.prisma.redeemCode.findMany.mockResolvedValue([] as any);
    mockLookupRepoIds();

    const returnedRepoIds = await checkGitPOAPForNewCodesWithApprovalEmail({
      ...gitPOAP,
      type: GitPOAPType.ANNUAL,
    });

    expect(returnedRepoIds).toEqual(repoIds);

    expect(contextMock.prisma.redeemCode.count).toHaveBeenCalledTimes(2);

    expectCountCodes(gitPOAP.id);

    expect(mockedRetrievePOAPCodes).toHaveBeenCalledTimes(1);
    expect(mockedRetrievePOAPCodes).toHaveBeenCalledWith(gitPOAP.poapEventId, gitPOAP.poapSecret);

    expect(contextMock.prisma.redeemCode.findMany).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.redeemCode.findMany).toHaveBeenCalledWith({
      where: { gitPOAPId: gitPOAP.id },
    });

    expectUpsertRedeemCode();

    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledWith({
      where: { id: gitPOAP.id },
      data: { poapApprovalStatus: GitPOAPStatus.APPROVED },
    });

    expect(contextMock.prisma.redeemCode.delete).toHaveBeenCalledTimes(0);

    expect(mockedSendGitPOAPRequestLiveEmail).toHaveBeenCalledTimes(0);
  });

  it('Should send a GitPOAP live email for GitPOAPRequest', async () => {
    contextMock.prisma.redeemCode.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    mockedRetrievePOAPCodes.mockResolvedValue([
      {
        qr_hash: redeemCode,
        claimed: false,
      },
    ]);
    contextMock.prisma.redeemCode.findMany.mockResolvedValue([] as any);
    mockLookupRepoIds();

    const returnedRepoIds = await checkGitPOAPForNewCodesWithApprovalEmail(gitPOAP);

    expect(returnedRepoIds).toEqual(repoIds);

    expect(contextMock.prisma.redeemCode.count).toHaveBeenCalledTimes(2);

    expectCountCodes(gitPOAP.id);

    expect(mockedRetrievePOAPCodes).toHaveBeenCalledTimes(1);
    expect(mockedRetrievePOAPCodes).toHaveBeenCalledWith(gitPOAP.poapEventId, gitPOAP.poapSecret);

    expect(contextMock.prisma.redeemCode.findMany).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.redeemCode.findMany).toHaveBeenCalledWith({
      where: { gitPOAPId: gitPOAP.id },
    });

    expectUpsertRedeemCode();

    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledWith({
      where: { id: gitPOAP.id },
      data: { poapApprovalStatus: GitPOAPStatus.APPROVED },
    });

    expect(contextMock.prisma.redeemCode.delete).toHaveBeenCalledTimes(0);

    expect(mockedSendGitPOAPRequestLiveEmail).toHaveBeenCalledTimes(1);
    expect(mockedSendGitPOAPRequestLiveEmail).toHaveBeenCalledWith({
      id: 34,
      name: 'foobar',
      email: 'test@gitpoap.io',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar.png-123456789'),
      description: 'foobar-description',
      startDate: DateTime.fromISO('2021-01-01').toFormat('yyyy LLL dd'),
      endDate: DateTime.fromISO('2021-01-10').toFormat('yyyy LLL dd'),
    });
  });

  it('Should not return repoIds for a REDEEM_REQUEST_PENDING GitPOAP', async () => {
    contextMock.prisma.redeemCode.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    mockedRetrievePOAPCodes.mockResolvedValue([
      {
        qr_hash: redeemCode,
        claimed: false,
      },
    ]);
    contextMock.prisma.redeemCode.findMany.mockResolvedValue([] as any);
    mockLookupRepoIds();

    const returnedRepoIds = await checkGitPOAPForNewCodesWithApprovalEmail({
      ...gitPOAP,
      poapApprovalStatus: GitPOAPStatus.REDEEM_REQUEST_PENDING,
    });

    expect(returnedRepoIds).toEqual([]);

    expect(contextMock.prisma.redeemCode.count).toHaveBeenCalledTimes(2);

    expectCountCodes(gitPOAP.id);

    expect(mockedRetrievePOAPCodes).toHaveBeenCalledTimes(1);
    expect(mockedRetrievePOAPCodes).toHaveBeenCalledWith(gitPOAP.poapEventId, gitPOAP.poapSecret);

    expect(contextMock.prisma.redeemCode.findMany).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.redeemCode.findMany).toHaveBeenCalledWith({
      where: { gitPOAPId: gitPOAP.id },
    });

    expectUpsertRedeemCode();

    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledWith({
      where: { id: gitPOAP.id },
      data: { poapApprovalStatus: GitPOAPStatus.APPROVED },
    });

    expect(contextMock.prisma.redeemCode.delete).toHaveBeenCalledTimes(0);

    expect(mockedSendGitPOAPRequestLiveEmail).toHaveBeenCalledTimes(0);
  });
});
