import { mockedLogger } from '../../../../__mocks__/src/logging';
import { contextMock } from '../../../../__mocks__/src/context';
import { retrieveUsersPOAPs, retrievePOAPEventInfo } from '../../../../src/external/poap';
import { splitUsersPOAPs } from '../../../../src/lib/poaps';
import { ADDRESSES } from '../../../../prisma/constants';
import { checkIfClaimTransferred, handleGitPOAPTransfer } from '../../../../src/lib/transfers';
import { ClaimStatus } from '@generated/type-graphql';

jest.mock('../../../../src/external/poap');
jest.mock('../../../../src/lib/transfers');

const mockedRetrieveUsersPOAPs = jest.mocked(retrieveUsersPOAPs, true);
const mockedRetrievePOAPEventInfo = jest.mocked(retrievePOAPEventInfo, true);
const mockedCheckIfClaimTransferred = jest.mocked(checkIfClaimTransferred, true);
const mockedHandleGitPOAPTransfer = jest.mocked(handleGitPOAPTransfer, true);

const claim1 = {
  id: 3,
  poapTokenId: 'foobar',
  status: ClaimStatus.CLAIMED,
  gitPOAP: {
    id: 45,
    poapEventId: 'barfoo',
  },
};
const claim2 = {
  id: 7,
  poapTokenId: 'yolo',
  status: ClaimStatus.CLAIMED,
  gitPOAP: {
    id: 89,
    poapEventId: 'swag',
  },
};

function genPOAP(claim: Record<string, any>) {
  return {
    tokenId: claim.poapTokenId,
    event: {
      id: claim.gitPOAP.poapEventId,
    },
  };
}

const poap1 = genPOAP(claim1);
const poap2 = genPOAP(claim2);

describe('splitUsersPOAPs', () => {
  it('Returns an error when call to POAP API fails', async () => {
    contextMock.prisma.claim.findMany.mockResolvedValue([]);
    mockedRetrieveUsersPOAPs.mockResolvedValue(null);
    contextMock.prisma.gitPOAP.findMany.mockResolvedValue([]);

    const result = await splitUsersPOAPs(ADDRESSES.burz);

    expect(result).toEqual(null);
    expect(mockedLogger.error).toHaveBeenCalledTimes(1);
  });

  it("Returns nothing when the user doesn't have any POAPs", async () => {
    contextMock.prisma.claim.findMany.mockResolvedValue([]);
    mockedRetrieveUsersPOAPs.mockResolvedValue([]);
    contextMock.prisma.gitPOAP.findMany.mockResolvedValue([]);
    contextMock.prisma.featuredPOAP.findMany.mockResolvedValue([]);

    const result = await splitUsersPOAPs(ADDRESSES.burz);

    expect(result).toEqual({ gitPOAPsOnly: [], poapsOnly: [] });

    expect(mockedRetrievePOAPEventInfo).toHaveBeenCalledTimes(0);
    expect(contextMock.prisma.featuredPOAP.delete).toHaveBeenCalledTimes(0);
    expect(mockedCheckIfClaimTransferred).toHaveBeenCalledTimes(0);
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(0);
  });

  it('Returns a single GitPOAP', async () => {
    contextMock.prisma.claim.findMany.mockResolvedValue([claim1] as any);
    mockedRetrieveUsersPOAPs.mockResolvedValue([poap1] as any);
    contextMock.prisma.gitPOAP.findMany.mockResolvedValue([
      { poapEventId: claim1.gitPOAP.poapEventId },
    ] as any);
    contextMock.prisma.featuredPOAP.findMany.mockResolvedValue([]);

    const result = await splitUsersPOAPs(ADDRESSES.burz);

    expect(result).toEqual({
      gitPOAPsOnly: [{ claim: claim1, event: poap1.event }],
      poapsOnly: [],
    });

    expect(mockedRetrievePOAPEventInfo).toHaveBeenCalledTimes(0);
    expect(contextMock.prisma.featuredPOAP.delete).toHaveBeenCalledTimes(0);
    expect(mockedCheckIfClaimTransferred).toHaveBeenCalledTimes(0);
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(0);
  });

  it('Skips Claims in a bad state', async () => {
    const claim1BadState = { ...claim1, poapTokenId: null };

    contextMock.prisma.claim.findMany.mockResolvedValue([claim1BadState] as any);
    mockedRetrieveUsersPOAPs.mockResolvedValue([]);
    contextMock.prisma.gitPOAP.findMany.mockResolvedValue([
      { poapEventId: claim1.gitPOAP.poapEventId },
    ] as any);
    contextMock.prisma.featuredPOAP.findMany.mockResolvedValue([]);

    const result = await splitUsersPOAPs(ADDRESSES.burz);

    expect(result).toEqual({ gitPOAPsOnly: [], poapsOnly: [] });

    expect(mockedLogger.error).toHaveBeenCalledTimes(1);
    expect(mockedRetrievePOAPEventInfo).toHaveBeenCalledTimes(0);
    expect(contextMock.prisma.featuredPOAP.delete).toHaveBeenCalledTimes(0);
    expect(mockedCheckIfClaimTransferred).toHaveBeenCalledTimes(0);
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(0);
  });

  it('Skips MINTING GitPOAPs when POAP API event lookup fails', async () => {
    const claim1Minting = { ...claim1, status: ClaimStatus.MINTING, poapTokenId: null };

    contextMock.prisma.claim.findMany.mockResolvedValue([claim1Minting] as any);
    mockedRetrieveUsersPOAPs.mockResolvedValue([]);
    contextMock.prisma.gitPOAP.findMany.mockResolvedValue([
      { poapEventId: claim1.gitPOAP.poapEventId },
    ] as any);
    mockedRetrievePOAPEventInfo.mockResolvedValue(null);
    contextMock.prisma.featuredPOAP.findMany.mockResolvedValue([]);

    const result = await splitUsersPOAPs(ADDRESSES.burz);

    expect(result).toEqual({ gitPOAPsOnly: [], poapsOnly: [] });

    expect(mockedLogger.error).toHaveBeenCalledTimes(1);
    expect(mockedRetrievePOAPEventInfo).toHaveBeenCalledTimes(1);
    expect(mockedRetrievePOAPEventInfo).toHaveBeenCalledWith(claim1.gitPOAP.poapEventId);
    expect(contextMock.prisma.featuredPOAP.delete).toHaveBeenCalledTimes(0);
    expect(mockedCheckIfClaimTransferred).toHaveBeenCalledTimes(0);
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(0);
  });

  it('Returns a single MINTING GitPOAP', async () => {
    const claim1Minting = { ...claim1, status: ClaimStatus.MINTING, poapTokenId: null };

    contextMock.prisma.claim.findMany.mockResolvedValue([claim1Minting] as any);
    mockedRetrieveUsersPOAPs.mockResolvedValue([]);
    contextMock.prisma.gitPOAP.findMany.mockResolvedValue([
      { poapEventId: claim1.gitPOAP.poapEventId },
    ] as any);
    mockedRetrievePOAPEventInfo.mockResolvedValue(poap1.event as any);
    contextMock.prisma.featuredPOAP.findMany.mockResolvedValue([]);

    const result = await splitUsersPOAPs(ADDRESSES.burz);

    expect(result).toEqual({
      gitPOAPsOnly: [{ claim: claim1Minting, event: poap1.event }],
      poapsOnly: [],
    });

    expect(mockedRetrievePOAPEventInfo).toHaveBeenCalledTimes(1);
    expect(mockedRetrievePOAPEventInfo).toHaveBeenCalledWith(claim1.gitPOAP.poapEventId);
    expect(contextMock.prisma.featuredPOAP.delete).toHaveBeenCalledTimes(0);
    expect(mockedCheckIfClaimTransferred).toHaveBeenCalledTimes(0);
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(0);
  });

  it('Returns a single POAP', async () => {
    contextMock.prisma.claim.findMany.mockResolvedValue([]);
    mockedRetrieveUsersPOAPs.mockResolvedValue([poap1] as any);
    contextMock.prisma.gitPOAP.findMany.mockResolvedValue([]);
    contextMock.prisma.featuredPOAP.findMany.mockResolvedValue([]);

    const result = await splitUsersPOAPs(ADDRESSES.burz);

    expect(result).toEqual({ gitPOAPsOnly: [], poapsOnly: [poap1] });

    expect(contextMock.prisma.featuredPOAP.delete).toHaveBeenCalledTimes(0);
    expect(mockedCheckIfClaimTransferred).toHaveBeenCalledTimes(0);
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(0);
  });

  it('Returns one of each', async () => {
    contextMock.prisma.claim.findMany.mockResolvedValue([claim1] as any);
    mockedRetrieveUsersPOAPs.mockResolvedValue([poap1, poap2] as any);
    contextMock.prisma.gitPOAP.findMany.mockResolvedValue([]);
    contextMock.prisma.featuredPOAP.findMany.mockResolvedValue([]);

    const result = await splitUsersPOAPs(ADDRESSES.burz);

    expect(result).toEqual({
      gitPOAPsOnly: [{ claim: claim1, event: poap1.event }],
      poapsOnly: [poap2],
    });

    expect(contextMock.prisma.featuredPOAP.delete).toHaveBeenCalledTimes(0);
    expect(mockedCheckIfClaimTransferred).toHaveBeenCalledTimes(0);
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(0);
  });

  it("Handles transfer into profile but falls back to POAP if can't find claim", async () => {
    contextMock.prisma.claim.findMany.mockResolvedValue([]);
    mockedRetrieveUsersPOAPs.mockResolvedValue([poap1] as any);
    contextMock.prisma.gitPOAP.findMany.mockResolvedValue([
      { poapEventId: claim1.gitPOAP.poapEventId },
    ] as any);
    contextMock.prisma.claim.findUnique.mockResolvedValue(null);
    contextMock.prisma.featuredPOAP.findMany.mockResolvedValue([]);

    const result = await splitUsersPOAPs(ADDRESSES.burz);

    expect(result).toEqual({ gitPOAPsOnly: [], poapsOnly: [poap1] });

    expect(contextMock.prisma.featuredPOAP.delete).toHaveBeenCalledTimes(0);
    expect(mockedCheckIfClaimTransferred).toHaveBeenCalledTimes(0);
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledWith({
      where: {
        poapTokenId: claim1.poapTokenId,
      },
      include: {
        mintedAddress: true,
        user: true,
        gitPOAP: {
          include: {
            project: {
              include: {
                repos: true,
              },
            },
          },
        },
      },
    });
    expect(mockedHandleGitPOAPTransfer).toHaveBeenCalledTimes(0);
  });

  it('Handles transfer into profile', async () => {
    contextMock.prisma.claim.findMany.mockResolvedValue([]);
    mockedRetrieveUsersPOAPs.mockResolvedValue([poap1] as any);
    contextMock.prisma.gitPOAP.findMany.mockResolvedValue([
      { poapEventId: claim1.gitPOAP.poapEventId },
    ] as any);
    contextMock.prisma.claim.findUnique.mockResolvedValue({
      id: claim1.id,
      mintedAddress: {
        ethAddress: ADDRESSES.jay,
      },
      gitPOAP: claim1.gitPOAP,
    } as any);
    contextMock.prisma.featuredPOAP.findMany.mockResolvedValue([]);
    mockedHandleGitPOAPTransfer.mockResolvedValue(claim1 as any);

    const result = await splitUsersPOAPs(ADDRESSES.burz);

    expect(result).toEqual({
      gitPOAPsOnly: [{ claim: claim1, event: poap1.event }],
      poapsOnly: [],
    });

    expect(contextMock.prisma.featuredPOAP.delete).toHaveBeenCalledTimes(0);
    expect(mockedCheckIfClaimTransferred).toHaveBeenCalledTimes(0);
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledWith({
      where: {
        poapTokenId: claim1.poapTokenId,
      },
      include: {
        mintedAddress: true,
        user: true,
        gitPOAP: {
          include: {
            project: {
              include: {
                repos: true,
              },
            },
          },
        },
      },
    });
    expect(mockedHandleGitPOAPTransfer).toHaveBeenCalledTimes(1);
    expect(mockedHandleGitPOAPTransfer).toHaveBeenCalledWith(
      claim1.id,
      claim1.poapTokenId,
      ADDRESSES.jay,
      ADDRESSES.burz,
    );
  });

  // See: https://stackoverflow.com/a/51045733/18750275
  const waitForAsync = async () => await new Promise(process.nextTick);

  it('postProcessing deletes transferred featured POAPs', async () => {
    const featured1 = { id: 3, poapTokenId: poap1.tokenId };

    contextMock.prisma.claim.findMany.mockResolvedValue([]);
    mockedRetrieveUsersPOAPs.mockResolvedValue([]);
    contextMock.prisma.gitPOAP.findMany.mockResolvedValue([]);
    contextMock.prisma.featuredPOAP.findMany.mockResolvedValue([featured1] as any);

    const result = await splitUsersPOAPs(ADDRESSES.burz);

    await waitForAsync();

    expect(result).toEqual({ gitPOAPsOnly: [], poapsOnly: [] });

    expect(contextMock.prisma.featuredPOAP.delete).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.featuredPOAP.delete).toHaveBeenCalledWith({
      where: { id: featured1.id },
    });
    expect(mockedCheckIfClaimTransferred).toHaveBeenCalledTimes(0);
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(0);
  });

  it('postProcessing handles GitPOAPs transferred out', async () => {
    contextMock.prisma.claim.findMany.mockResolvedValue([claim1] as any);
    mockedRetrieveUsersPOAPs.mockResolvedValue([]);
    contextMock.prisma.gitPOAP.findMany.mockResolvedValue([]);
    contextMock.prisma.featuredPOAP.findMany.mockResolvedValue([]);

    const result = await splitUsersPOAPs(ADDRESSES.burz);

    await waitForAsync();

    expect(result).toEqual({ gitPOAPsOnly: [], poapsOnly: [] });

    expect(contextMock.prisma.featuredPOAP.delete).toHaveBeenCalledTimes(0);
    expect(mockedCheckIfClaimTransferred).toHaveBeenCalledTimes(1);
    expect(mockedCheckIfClaimTransferred).toHaveBeenCalledWith(claim1.id);
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(0);
  });
});
