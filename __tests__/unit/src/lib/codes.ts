import { mockedLogger } from '../../../../__mocks__/src/logging';
import { contextMock } from '../../../../__mocks__/src/context';
import { retrieveUnusedPOAPCodes } from '../../../../src/external/poap';
import { checkGitPOAPForNewCodes, GitPOAPWithSecret } from '../../../../src/lib/codes';
import { GitPOAPStatus } from '@generated/type-graphql';

jest.mock('../../../../src/external/poap');

const mockedRetrieveUnusedPOAPCodes = jest.mocked(retrieveUnusedPOAPCodes, true);

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

const gitPOAP: GitPOAPWithSecret = {
  id: 34,
  poapApprovalStatus: GitPOAPStatus.UNAPPROVED,
  poapEventId: 32423,
  poapSecret: 'foobar',
};

const repoIds = [34, 4, 3];

describe('checkGitPOAPForNewCodes', () => {
  const expectCountCodes = (gitPOAPId: number) => {
    expect(contextMock.prisma.redeemCode.count).toHaveBeenCalledWith({
      where: { gitPOAPId },
    });
  };

  it('Should exit with a warning when code retrieval fails', async () => {
    contextMock.prisma.redeemCode.count.mockResolvedValue(10);
    mockedRetrieveUnusedPOAPCodes.mockResolvedValue(null);

    const returnedRepoIds = await checkGitPOAPForNewCodes(gitPOAP);

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

    const returnedRepoIds = await checkGitPOAPForNewCodes(gitPOAP);

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

    const returnedRepoIds = await checkGitPOAPForNewCodes(gitPOAP);

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

    const returnedRepoIds = await checkGitPOAPForNewCodes(gitPOAP);

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

  it('Should not return repoIds for a REDEEM_REQUEST_PENDING GitPOAP', async () => {
    contextMock.prisma.redeemCode.count.mockResolvedValueOnce(5).mockResolvedValueOnce(10);
    mockedRetrieveUnusedPOAPCodes.mockResolvedValue(fakeCodes);

    const returnedRepoIds = await checkGitPOAPForNewCodes({
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
