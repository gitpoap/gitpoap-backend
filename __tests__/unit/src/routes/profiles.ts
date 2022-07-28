import { contextMock } from '../../../../__mocks__/src/context';
import request from 'supertest';
import { setupApp } from '../../../../src/app';
import { isSignatureValid } from '../../../../src/signatures';
import { resolveENS } from '../../../../src/external/ens';

jest.mock('../../../../src/signatures');
jest.mock('../../../../src/external/ens');

const mockedIsSignatureValid = jest.mocked(isSignatureValid, true);
const mockedResolveENS = jest.mocked(resolveENS, true);

const goodAddress = '0x206e554084BEeC98e08043397be63C5132Cc01A1';
const fakeSignature = {
  data: 'yeet',
  createdAt: 1647987506199,
};

describe('POST /profiles', () => {
  it('Fails on bad fields in request', async () => {
    const result = await request(await setupApp())
      .post('/profiles').send({ foobar: 'yeet' });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails on missing signature', async () => {
    const result = await request(await setupApp()).post('/profiles').send({
      address: goodAddress,
      data: { githubHandle: null },
    });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails on bad address', async () => {
    mockedResolveENS.mockResolvedValue(null);

    const result = await request(await setupApp()).post('/profiles').send({
      address: 'foobar',
      signature: {
        data: 'yeet',
        createdAt: 1647987506199,
      },
      data: { githubHandle: null },
    });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails on bad signature', async () => {
    mockedIsSignatureValid.mockReturnValue(false);
    mockedResolveENS.mockResolvedValue(goodAddress);

    const data = { githubHandle: null };

    const result = await request(await setupApp()).post('/profiles').send({
      address: goodAddress,
      signature: fakeSignature,
      data,
    });

    expect(result.statusCode).toEqual(401);
    expect(mockedIsSignatureValid).toHaveBeenCalledTimes(1);
    expect(mockedIsSignatureValid).toHaveBeenCalledWith(
      goodAddress,
      'POST /profiles',
      fakeSignature,
      { data },
    );
  });

  const validateUpsert = (data: Record<string, any>) => {
    const address = goodAddress.toLowerCase();

    expect(contextMock.prisma.profile.upsert).toHaveBeenCalledWith({
      where: { address },
      update: data,
      create: {
        address,
        ...data,
      },
    });
  };

  it('Allows missing data fields', async () => {
    mockedIsSignatureValid.mockReturnValue(true);
    mockedResolveENS.mockResolvedValue(goodAddress);

    const data = {};

    const result = await request(await setupApp()).post('/profiles').send({
      address: goodAddress,
      signature: fakeSignature,
      data,
    });

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.profile.upsert).toHaveBeenCalledTimes(1);

    validateUpsert(data);
  });

  it('Allows setting of all fields', async () => {
    mockedIsSignatureValid.mockReturnValue(true);
    mockedResolveENS.mockResolvedValue(goodAddress);

    const data = {
      bio: 'foo',
      bannerImageUrl: 'bar',
      name: 'yeet',
      profileImageUrl: 'yolo',
      githubHandle: 'obi',
      twitterHandle: 'wan',
      personalSiteUrl: 'kenobi',
      leaderboardVisible: true,
    };

    const result = await request(await setupApp()).post('/profiles').send({
      address: goodAddress,
      signature: fakeSignature,
      data,
    });

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.profile.upsert).toHaveBeenCalledTimes(1);

    validateUpsert(data);
  });

  it('Allows nullification of most fields', async () => {
    mockedIsSignatureValid.mockReturnValue(true);
    mockedResolveENS.mockResolvedValue(goodAddress);

    const data = {
      bio: null,
      bannerImageUrl: null,
      name: null,
      profileImageUrl: null,
      githubHandle: null,
      twitterHandle: null,
      personalSiteUrl: null,
    };

    const result = await request(await setupApp()).post('/profiles').send({
      address: goodAddress,
      signature: fakeSignature,
      data,
    });

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.profile.upsert).toHaveBeenCalledTimes(1);

    validateUpsert(data);
  });

  it('Allows toggling of leaderboard visibility', async () => {
    mockedIsSignatureValid.mockReturnValue(true);
    mockedResolveENS.mockResolvedValue(goodAddress);

    let data = {
      leaderboardVisible: false,
    };

    let result = await request(await setupApp()).post('/profiles').send({
      address: goodAddress,
      signature: fakeSignature,
      data,
    });

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.profile.upsert).toHaveBeenCalledTimes(1);

    validateUpsert(data);

    data.leaderboardVisible = true;

    result = await request(await setupApp()).post('/profiles').send({
      address: goodAddress,
      signature: fakeSignature,
      data,
    });

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.profile.upsert).toHaveBeenCalledTimes(2);

    validateUpsert(data);
  });
});
