import { isSignatureValid } from '../../../../src/lib/signatures';
import { utils } from 'ethers';
import { DateTime } from 'luxon';
import { ADDRESSES } from '../../../../prisma/constants';
import { SIGNATURE_TTL_DAYS } from '../../../../src/constants';

jest.mock('ethers', () => ({
  utils: {
    verifyMessage: jest.fn(),
  },
}));

const address = ADDRESSES.burz;

const mockedVerifyMessage = jest.mocked(utils.verifyMessage, true);

describe('isSignatureValid', () => {
  const genSigData = (createdAt: number) => ({
    message: 'The pen is mightier than the sword.',
    createdAt,
  });

  it('Returns false if the signature is too old', () => {
    const oldTime = DateTime.now().minus({ days: SIGNATURE_TTL_DAYS + 2 });

    const signatureData = genSigData(oldTime.toSeconds() * 1000.0);

    const result = isSignatureValid(address, signatureData, 'foobar');

    expect(result).toEqual(false);

    expect(mockedVerifyMessage).toHaveBeenCalledTimes(0);
  });

  it('Returns false if the signature is invalid', () => {
    mockedVerifyMessage.mockReturnValue('0xinvalidAddress');

    const signatureData = genSigData(DateTime.now().toSeconds() * 1000.0);
    const signature = 'burz wuz here';

    const result = isSignatureValid(address, signatureData, signature);

    expect(result).toEqual(false);

    expect(mockedVerifyMessage).toHaveBeenCalledTimes(1);
    expect(mockedVerifyMessage).toHaveBeenCalledWith(signatureData.message, signature);
  });

  it('Returns true if the signature is valid', () => {
    mockedVerifyMessage.mockReturnValue(address);

    const signatureData = genSigData(DateTime.now().toSeconds() * 1000.0);
    const signature = 'burz wuz here too';

    const result = isSignatureValid(address, signatureData, signature);

    expect(result).toEqual(true);

    expect(mockedVerifyMessage).toHaveBeenCalledTimes(1);
    expect(mockedVerifyMessage).toHaveBeenCalledWith(signatureData.message, signature);
  });
});
