import { mockDeep } from 'jest-mock-extended';
import { Multer } from 'multer';
import '../../../../../__mocks__/src/logging';
import { contextMock } from '../../../../../__mocks__/src/context';
import { setupApp } from '../../../../../src/app';
import { generateAuthTokens } from '../../../../../src/lib/authTokens';
import request from 'supertest';
import { uploadMulterFile } from '../../../../../src/external/s3';

const authTokenId = 4;
const authTokenGeneration = 1;
const addressId = 342;
const address = '0xburzistheword';
const ensName = 'furby.eth';
const ensAvatarImageUrl = null;

jest.mock('../../../../../src/logging');
jest.mock('../../../../../src/external/s3', () => {
  const originalModule = jest.requireActual('../../../../../src/external/s3');
  return {
    __esModule: true,
    ...originalModule,
    s3configProfile: {
      region: 'us-east-2',
      buckets: {
        intakeForm: 'intake-form-test',
        ensAvatarCache: 'ens-avatar-cache-test',
        gitPOAPRequest: 'gitpoap-request-images-test',
      },
    },
    uploadMulterFile: jest.fn(),
    getImageBufferFromS3: jest.fn(),
  };
});

jest.mock('multer', () =>
  jest.fn().mockReturnValue(
    mockDeep<Multer>({
      single: jest.fn().mockReturnValue((req: any, res: any, next: any) => {
        return next();
      }),
      array: () => (req: any, res: any, next: any) => {
        return next();
      },
    }),
  ),
);

const mockedUploadMulterFile = jest.mocked(uploadMulterFile, true);

function genAuthTokens(someGithubId?: number, githubHandle?: string) {
  return generateAuthTokens(
    authTokenId,
    authTokenGeneration,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    someGithubId ?? null,
    githubHandle ?? null,
  );
}

function mockJwtWithAddress() {
  contextMock.prisma.authToken.findUnique.mockResolvedValue({
    id: authTokenId,
    address: { ensName, ensAvatarImageUrl },
  } as any);
}

describe('POST /gitpoaps/custom', () => {
  afterAll(() => {
    jest.resetAllMocks();
  });

  it('Fails when no image is provided', async () => {
    mockJwtWithAddress();
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .post('/gitpoaps/custom')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({
        name: 'foobar-name',
        description: 'foobar-description',
        startDate: '2021-01-01',
        endDate: '2021-01-10',
        expiryDate: '2023-01-01',
        eventUrl: 'https://foobar.com',
        email: 'jay@gitpoap.io',
        numRequestedCodes: 50,
        ongoing: 'true',
        isEnabled: 'true',
        year: 2021,
        contributors: JSON.stringify({
          githubHandles: ['peebeejay'],
          ensNames: ['burz.eth'],
        }),
      });

    expect(result.statusCode).toEqual(400);

    /* Expect that the image was not uploaded to S3 */
    expect(mockedUploadMulterFile).toHaveBeenCalledTimes(0);
  });
});
