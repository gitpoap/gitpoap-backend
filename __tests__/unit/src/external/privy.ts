import '../../../../__mocks__/src/logging';
import { verifyPrivyTokenForData } from '../../../../src/external/privy';
import { contextMock } from '../../../../__mocks__/src/context';

jest.mock('../../../../src/logging');

const privyToken = 'yo wassup bae';
const privyUserId = 'I am I';
const verifiedClaims = { userId: privyUserId };
const ethAddressUpper = '0xFoobar';
const ethAddress = ethAddressUpper.toLowerCase();
const emailAddressUpper = 'Foobar@YeetYolo.com';
const emailAddress = emailAddressUpper.toLowerCase();
const discordId = 'hi';
const discordHandle = 'umami';
const discord = { discordId, discordHandle };

describe('verifyPrivyTokenForData', () => {
  it('Returns null if verifyAuthToken fails', async () => {
    contextMock.privy.verifyAuthToken.mockImplementationOnce(() => {
      throw new Error('error');
    });

    const result = await verifyPrivyTokenForData(contextMock.privy, privyToken);

    expect(result).toEqual(null);

    expect(contextMock.privy.verifyAuthToken).toHaveBeenCalledTimes(1);
    expect(contextMock.privy.verifyAuthToken).toHaveBeenCalledWith(privyToken);
  });

  const expectPrivyCalls = () => {
    expect(contextMock.privy.verifyAuthToken).toHaveBeenCalledTimes(1);
    expect(contextMock.privy.verifyAuthToken).toHaveBeenCalledWith(privyToken);

    expect(contextMock.privy.getUser).toHaveBeenCalledTimes(1);
    expect(contextMock.privy.getUser).toHaveBeenCalledWith(privyUserId);
  };

  it('Returns null if getUser fails', async () => {
    contextMock.privy.verifyAuthToken.mockResolvedValue(verifiedClaims as any);
    contextMock.privy.getUser.mockImplementationOnce(() => {
      throw new Error('error');
    });

    const result = await verifyPrivyTokenForData(contextMock.privy, privyToken);

    expect(result).toEqual(null);

    expectPrivyCalls();
  });

  it("Doesn't return an address from another chain", async () => {
    contextMock.privy.verifyAuthToken.mockResolvedValue(verifiedClaims as any);
    contextMock.privy.getUser.mockResolvedValue({
      wallet: { chainType: 'solana' }, // Yuck
    } as any);

    const result = await verifyPrivyTokenForData(contextMock.privy, privyToken);

    expect(result).toEqual({
      privyUserId,
      ethAddress: null,
      emailAddress: null,
      discord: null,
    });

    expectPrivyCalls();
  });

  it('Returns ethAddress if it is set', async () => {
    contextMock.privy.verifyAuthToken.mockResolvedValue(verifiedClaims as any);
    contextMock.privy.getUser.mockResolvedValue({
      wallet: {
        chainType: 'ethereum',
        address: ethAddressUpper,
      },
    } as any);

    const result = await verifyPrivyTokenForData(contextMock.privy, privyToken);

    expect(result).toEqual({
      privyUserId,
      ethAddress,
      emailAddress: null,
      discord: null,
    });

    expectPrivyCalls();
  });

  it('Returns email if it is set', async () => {
    contextMock.privy.verifyAuthToken.mockResolvedValue(verifiedClaims as any);
    contextMock.privy.getUser.mockResolvedValue({
      email: { address: emailAddressUpper },
    } as any);

    const result = await verifyPrivyTokenForData(contextMock.privy, privyToken);

    expect(result).toEqual({
      privyUserId,
      ethAddress: null,
      emailAddress,
      discord: null,
    });

    expectPrivyCalls();
  });

  it('Returns discord if it is set', async () => {
    contextMock.privy.verifyAuthToken.mockResolvedValue(verifiedClaims as any);
    contextMock.privy.getUser.mockResolvedValue({
      discord: {
        subject: discordId,
        username: discordHandle,
      },
    } as any);

    const result = await verifyPrivyTokenForData(contextMock.privy, privyToken);

    expect(result).toEqual({
      privyUserId,
      ethAddress: null,
      emailAddress: null,
      discord,
    });

    expectPrivyCalls();
  });

  it('Returns everything if it is all set', async () => {
    contextMock.privy.verifyAuthToken.mockResolvedValue(verifiedClaims as any);
    contextMock.privy.getUser.mockResolvedValue({
      wallet: {
        chainType: 'ethereum',
        address: ethAddressUpper,
      },
      email: { address: emailAddressUpper },
      discord: {
        subject: discordId,
        username: discordHandle,
      },
    } as any);

    const result = await verifyPrivyTokenForData(contextMock.privy, privyToken);

    expect(result).toEqual({
      privyUserId,
      ethAddress,
      emailAddress,
      discord,
    });

    expectPrivyCalls();
  });
});
