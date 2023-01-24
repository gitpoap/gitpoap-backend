import '../../../../__mocks__/src/logging';
import { contextMock } from '../../../../__mocks__/src/context';
import request from 'supertest';
import { setupApp } from '../../../../__mocks__/src/app';
import { resolveENS } from '../../../../src/lib/ens';
import { setupGenAuthTokens } from '../../../../__mocks__/src/lib/authTokens';
import { S3ClientConfigProfile, uploadFileBuffer } from '../../../../src/external/s3';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/lib/ens');
jest.mock('../../../../src/external/s3', () => {
  const originalModule = jest.requireActual('../../../../src/external/s3');
  return {
    __esModule: true,
    ...originalModule,
    s3configProfile: <S3ClientConfigProfile>{
      region: 'us-east-2',
      buckets: {
        teamLogoImages: 'team-logo-images-test',
      },
    },
    uploadFileBuffer: jest.fn(),
    getImageBufferFromS3: jest.fn(),
    getImageBufferFromS3URL: jest.fn(),
  };
});

const mockedResolveENS = jest.mocked(resolveENS, true);
const mockedUploadFileBuffer = jest.mocked(uploadFileBuffer, true);

const privyUserId = 'user:3243243';
const addressId = 3242;
const ethAddress = '0x206e554084BEeC98e08043397be63C5132Cc01A1';
const ensName = 'annab.eth';
const ensAvatarImageUrl = null;

const teamRequest = {
  name: 'test team',
  description: 'test team description',
  image: {
    data: Buffer.from('foobar'),
    mimetype: 'image/png',
    name: 'foobar.png',
    originalname: 'foobar.png',
  },
  adminAddressId: addressId,
};

const teamRecord = { id: 1 };

const genAuthTokens = setupGenAuthTokens({
  privyUserId,
  addressId,
  ethAddress,
  ensName,
  ensAvatarImageUrl,
});

describe('POST /teams', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .post('/teams')
      .send({ githubHandle: null });

    expect(result.statusCode).toEqual(400);
  });

  it('Fails on bad fields in request', async () => {
    const authTokens = genAuthTokens();

    {
      const result = await request(await setupApp())
        .post('/teams')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ foobar: 'yeet' });
      expect(result.statusCode).toEqual(400);
    }
    {
      const result = await request(await setupApp())
        .post('/teams')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ data: { foobar: 'yeet' } });
      expect(result.statusCode).toEqual(400);
    }
  });

  it('Create a team', async () => {
    mockedResolveENS.mockResolvedValue(ethAddress);
    mockedUploadFileBuffer.mockResolvedValue({
      filename: 'test-team-logo',
    } as any);
    contextMock.prisma.team.create.mockResolvedValue({ ...teamRecord } as any);

    const authTokens = genAuthTokens();

    const result = (await request(await setupApp())
      .post('/teams')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ ...teamRequest })) as any;

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.team.create).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.membership.create).toHaveBeenCalledTimes(1);

    expect(result.body).toEqual(teamRecord);
  });
});
