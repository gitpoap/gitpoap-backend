import '../../../../__mocks__/src/logging';
import { contextMock } from '../../../../__mocks__/src/context';
import request from 'supertest';
import { setupApp } from '../../../../__mocks__/src/app';
import { resolveENS } from '../../../../src/lib/ens';
import { generateAuthTokens } from '../../../../src/lib/authTokens';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/lib/ens');

const mockedResolveENS = jest.mocked(resolveENS, true);

const privyUserId = 'I am I';
const addressId = 3242;
const address = '0x206e554084BEeC98e08043397be63C5132Cc01A1';
const ensName = 'annab.eth';
const ensAvatarImageUrl = null;

const addressRecord = {
  id: addressId,
  ethAddress: address,
  ensName,
  ensAvatarImageUrl,
  createdAt: new Date(),
  updatedAt: new Date(),
  githubUserId: null,
  emailId: null,
  discordUserId: null,
};

function mockJwtWithAddress() {
  contextMock.prisma.address.findUnique.mockResolvedValue({
    ensName,
    ensAvatarImageUrl,
    memberships: [],
  } as any);
}

function genAuthTokens() {
  return generateAuthTokens(
    privyUserId,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    [],
    null,
    null,
    null,
    null,
  );
}

describe('POST /profiles', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .post('/profiles')
      .send({ githubHandle: null });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails on bad fields in request', async () => {
    mockJwtWithAddress();

    const authTokens = genAuthTokens();

    {
      const result = await request(await setupApp())
        .post('/profiles')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ foobar: 'yeet' });
      expect(result.statusCode).toEqual(400);
    }
    {
      const result = await request(await setupApp())
        .post('/profiles')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ data: { foobar: 'yeet' } });
      expect(result.statusCode).toEqual(400);
    }
  });

  it('Fails on bad address', async () => {
    mockJwtWithAddress();
    mockedResolveENS.mockResolvedValue(null);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/profiles')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ githubHandle: null });

    expect(result.statusCode).toEqual(400);
  });

  const validateUpsert = (data: Record<string, any>) => {
    expect(contextMock.prisma.profile.upsert).toHaveBeenCalledWith({
      where: { addressId: addressRecord.id },
      update: data,
      create: {
        address: {
          connect: { id: addressRecord.id },
        },
        ...data,
      },
    });
  };

  it('Allows missing data fields', async () => {
    mockJwtWithAddress();
    mockedResolveENS.mockResolvedValue(address);
    contextMock.prisma.address.upsert.mockResolvedValue(addressRecord);

    const authTokens = genAuthTokens();

    const data = {};

    const result = await request(await setupApp())
      .post('/profiles')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ data });

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.profile.upsert).toHaveBeenCalledTimes(1);

    validateUpsert(data);
  });

  it('Allows setting of all fields', async () => {
    mockJwtWithAddress();
    mockedResolveENS.mockResolvedValue(address);
    contextMock.prisma.address.upsert.mockResolvedValue(addressRecord);

    const authTokens = genAuthTokens();

    const data = {
      bio: 'foo',
      bannerImageUrl: 'bar',
      name: 'yeet',
      profileImageUrl: 'yolo',
      twitterHandle: 'wan',
      personalSiteUrl: 'kenobi',
      isVisibleOnLeaderboard: true,
    };

    const result = await request(await setupApp())
      .post('/profiles')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ data });

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.profile.upsert).toHaveBeenCalledTimes(1);

    validateUpsert(data);
  });

  it('Allows nullification of most fields', async () => {
    mockJwtWithAddress();
    mockedResolveENS.mockResolvedValue(address);
    contextMock.prisma.address.upsert.mockResolvedValue(addressRecord);

    const authTokens = genAuthTokens();

    const data = {
      bio: null,
      bannerImageUrl: null,
      name: null,
      profileImageUrl: null,
      twitterHandle: null,
      personalSiteUrl: null,
    };

    const result = await request(await setupApp())
      .post('/profiles')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ data });

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.profile.upsert).toHaveBeenCalledTimes(1);

    validateUpsert(data);
  });

  it('Allows toggling of leaderboard visibility', async () => {
    mockJwtWithAddress();
    mockedResolveENS.mockResolvedValue(address);
    contextMock.prisma.address.upsert.mockResolvedValue(addressRecord);

    const authTokens = genAuthTokens();

    const data = {
      isVisibleOnLeaderboard: false,
    };

    let result = await request(await setupApp())
      .post('/profiles')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ data });

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.profile.upsert).toHaveBeenCalledTimes(1);

    validateUpsert(data);

    data.isVisibleOnLeaderboard = true;

    result = await request(await setupApp())
      .post('/profiles')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ data });

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.profile.upsert).toHaveBeenCalledTimes(2);

    validateUpsert(data);
  });
});
