import { GitPOAPStatus } from '@generated/type-graphql';
import { GitPOAPType } from '@prisma/client';
import { mockedLogger } from '../../../../__mocks__/src/logging';
import { contextMock } from '../../../../__mocks__/src/context';
import { retrievePOAPCodes } from '../../../../src/external/poap';
import {
  CheckGitPOAPForCodesWithExtrasType,
  checkGitPOAPForNewCodesWithApprovalEmail,
} from '../../../../src/lib/codes';
import { sendGitPOAPRequestLiveEmail } from '../../../../src/external/postmark';
import { getS3URL } from '../../../../src/external/s3';
import { DateTime } from 'luxon';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/external/poap');

jest.mock('../../../../src/external/postmark');
jest.mocked(sendGitPOAPRequestLiveEmail, true);

const mockedRetrieveUnusedPOAPCodes = jest.mocked(retrievePOAPCodes, true);

// 10 codes
const fakeCodes = [
  '123456',
  '123457',
  '123458',
  '123459',
  '123460',
  '123461',
  '123462',
  '123462',
  '123463',
  '123464',
];

const gitPOAP: CheckGitPOAPForCodesWithExtrasType = {
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
  creatorEmail: {
    emailAddress: 'test@gitpoap.io',
  },
  gitPOAPRequest: {
    startDate: DateTime.fromISO('2021-01-01').toJSDate(),
    endDate: DateTime.fromISO('2021-01-10').toJSDate(),
  },
} as any;

const repoIds = [34, 4, 3];

describe('checkGitPOAPForNewCodesWithApprovalEmail', () => {
  const expectCountCodes = (gitPOAPId: number) => {
    expect(contextMock.prisma.redeemCode.count).toHaveBeenCalledWith({
      where: { gitPOAPId },
    });
  };

  it('Should exit with a warning when code retrieval fails', async () => {
    contextMock.prisma.redeemCode.count.mockResolvedValue(10);
    mockedRetrieveUnusedPOAPCodes.mockResolvedValue(null);

    const returnedRepoIds = await checkGitPOAPForNewCodesWithApprovalEmail(gitPOAP);

    expect(returnedRepoIds).toEqual([]);

    expect(contextMock.prisma.redeemCode.count).toHaveBeenCalledTimes(1);
    expectCountCodes(gitPOAP.id);

    expect(mockedRetrieveUnusedPOAPCodes).toHaveBeenCalledTimes(1);
    expect(mockedRetrieveUnusedPOAPCodes).toHaveBeenCalledWith(
      gitPOAP.poapEventId,
      gitPOAP.poapSecret,
    );

    expect(mockedLogger.warn).toHaveBeenCalledTimes(1);

    expect(contextMock.prisma.redeemCode.upsert).toHaveBeenCalledTimes(0);
  });

  const expectUpsertCode = (gitPOAPId: number, code: string) => {
    expect(contextMock.prisma.redeemCode.upsert).toHaveBeenCalledWith({
      where: {
        gitPOAPId_code: {
          gitPOAPId,
          code,
        },
      },
      update: {},
      create: {
        gitPOAP: {
          connect: {
            id: gitPOAPId,
          },
        },
        code,
      },
    });
  };

  it('Should do nothing when the count is unchanged', async () => {
    contextMock.prisma.redeemCode.count.mockResolvedValue(10);
    mockedRetrieveUnusedPOAPCodes.mockResolvedValue(fakeCodes);

    const returnedRepoIds = await checkGitPOAPForNewCodesWithApprovalEmail(gitPOAP);

    expect(returnedRepoIds).toEqual([]);

    expect(contextMock.prisma.redeemCode.count).toHaveBeenCalledTimes(2);
    expectCountCodes(gitPOAP.id);

    expect(mockedRetrieveUnusedPOAPCodes).toHaveBeenCalledTimes(1);
    expect(mockedRetrieveUnusedPOAPCodes).toHaveBeenCalledWith(
      gitPOAP.poapEventId,
      gitPOAP.poapSecret,
    );

    expect(contextMock.prisma.redeemCode.upsert).toHaveBeenCalledTimes(10);
    for (const code of fakeCodes) {
      expectUpsertCode(gitPOAP.id, code);
    }

    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledTimes(0);
  });

  // Handles the case where a user mints while the process is running
  it('Should do nothing when the count is less', async () => {
    contextMock.prisma.redeemCode.count.mockResolvedValueOnce(10).mockResolvedValueOnce(9);
    mockedRetrieveUnusedPOAPCodes.mockResolvedValue(fakeCodes);

    const returnedRepoIds = await checkGitPOAPForNewCodesWithApprovalEmail(gitPOAP);

    expect(returnedRepoIds).toEqual([]);

    expect(contextMock.prisma.redeemCode.count).toHaveBeenCalledTimes(2);
    expectCountCodes(gitPOAP.id);

    expect(mockedRetrieveUnusedPOAPCodes).toHaveBeenCalledTimes(1);
    expect(mockedRetrieveUnusedPOAPCodes).toHaveBeenCalledWith(
      gitPOAP.poapEventId,
      gitPOAP.poapSecret,
    );

    expect(contextMock.prisma.redeemCode.upsert).toHaveBeenCalledTimes(10);
    for (const code of fakeCodes) {
      expectUpsertCode(gitPOAP.id, code);
    }

    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledTimes(0);
  });

  const mockLookupRepoIds = () => {
    contextMock.prisma.gitPOAP.findUnique.mockResolvedValue({
      project: {
        repos: [{ id: repoIds[0] }, { id: repoIds[1] }, { id: repoIds[2] }],
      },
    } as any);
  };

  it('Should update the status of the GitPOAP after receiving more codes', async () => {
    contextMock.prisma.redeemCode.count.mockResolvedValueOnce(5).mockResolvedValueOnce(10);
    mockedRetrieveUnusedPOAPCodes.mockResolvedValue(fakeCodes);
    mockLookupRepoIds();

    const returnedRepoIds = await checkGitPOAPForNewCodesWithApprovalEmail(gitPOAP);

    expect(returnedRepoIds).toEqual(repoIds);

    expect(contextMock.prisma.redeemCode.count).toHaveBeenCalledTimes(2);
    expectCountCodes(gitPOAP.id);

    expect(mockedRetrieveUnusedPOAPCodes).toHaveBeenCalledTimes(1);
    expect(mockedRetrieveUnusedPOAPCodes).toHaveBeenCalledWith(
      gitPOAP.poapEventId,
      gitPOAP.poapSecret,
    );

    expect(contextMock.prisma.redeemCode.upsert).toHaveBeenCalledTimes(10);
    for (const code of fakeCodes) {
      expectUpsertCode(gitPOAP.id, code);
    }

    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledWith({
      where: {
        id: gitPOAP.id,
      },
      data: {
        poapApprovalStatus: GitPOAPStatus.APPROVED,
      },
    });
  });

  it('Should send a gitpoap live email for GitPOAPRequest', async () => {
    expect(gitPOAP.poapApprovalStatus).toEqual(GitPOAPStatus.UNAPPROVED);
    contextMock.prisma.gitPOAPRequest.findUnique.mockResolvedValue(gitPOAP as any);
    contextMock.prisma.redeemCode.count.mockResolvedValueOnce(5).mockResolvedValueOnce(10);
    mockedRetrieveUnusedPOAPCodes.mockResolvedValue(fakeCodes);
    mockLookupRepoIds();

    await checkGitPOAPForNewCodesWithApprovalEmail(gitPOAP);

    expect(sendGitPOAPRequestLiveEmail).toHaveBeenCalledWith({
      id: 34,
      name: 'foobar',
      email: 'test@gitpoap.io',
      imageUrl: getS3URL('gitpoap-request-images-test', 'foobar.png-123456789'),
      description: 'foobar-description',
      startDate: DateTime.fromISO('2021-01-01').toFormat('yyyy LLL dd'),
      endDate: DateTime.fromISO('2021-01-10').toFormat('yyyy LLL dd'),
    });

    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledWith({
      where: {
        id: gitPOAP.id,
      },
      data: {
        poapApprovalStatus: GitPOAPStatus.APPROVED,
      },
    });
  });

  it('Should not return repoIds for a REDEEM_REQUEST_PENDING GitPOAP', async () => {
    contextMock.prisma.redeemCode.count.mockResolvedValueOnce(5).mockResolvedValueOnce(10);
    mockedRetrieveUnusedPOAPCodes.mockResolvedValue(fakeCodes);

    const returnedRepoIds = await checkGitPOAPForNewCodesWithApprovalEmail({
      ...gitPOAP,
      poapApprovalStatus: GitPOAPStatus.REDEEM_REQUEST_PENDING,
    });

    expect(returnedRepoIds).toEqual([]);

    expect(contextMock.prisma.redeemCode.count).toHaveBeenCalledTimes(2);
    expectCountCodes(gitPOAP.id);

    expect(mockedRetrieveUnusedPOAPCodes).toHaveBeenCalledTimes(1);
    expect(mockedRetrieveUnusedPOAPCodes).toHaveBeenCalledWith(
      gitPOAP.poapEventId,
      gitPOAP.poapSecret,
    );

    expect(contextMock.prisma.redeemCode.upsert).toHaveBeenCalledTimes(10);
    for (const code of fakeCodes) {
      expectUpsertCode(gitPOAP.id, code);
    }

    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.gitPOAP.update).toHaveBeenCalledWith({
      where: {
        id: gitPOAP.id,
      },
      data: {
        poapApprovalStatus: GitPOAPStatus.APPROVED,
      },
    });
  });
});
