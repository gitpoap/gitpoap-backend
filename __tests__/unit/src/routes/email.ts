import { contextMock } from '../../../../__mocks__/src/context';
import '../../../../__mocks__/src/logging';
import request from 'supertest';
import { setupApp } from '../../../../__mocks__/src/app';
import { sendVerificationEmail } from '../../../../src/external/postmark';
import { generateAuthTokens } from '../../../../src/lib/authTokens';
import { DateTime } from 'luxon';
import { upsertUnverifiedEmail } from '../../../../src/lib/emails';

jest.mock('../../../../src/lib/ens');
jest.mock('../../../../src/lib/emails', () => ({
  generateUniqueEmailToken: jest.fn().mockResolvedValue('1q2w3e4r5t6y7u8i9o0p'),
  upsertUnverifiedEmail: jest.fn(),
}));
jest.mock('../../../../src/logging');
jest.mock('../../../../src/external/postmark');

const mockedUpsertUnverifiedEmail = jest.mocked(upsertUnverifiedEmail, true);
const mockedSendVerificationEmail = jest.mocked(sendVerificationEmail, true);

const authTokenId = 123;
const authTokenGeneration = 456;
const addressId = 789;
const address = '0x206e554084BEeC98e08043397be63C5132Cc01A1';
const ensName = 'gitpoap.eth';
const ensAvatarImageUrl = null;

const testEmailAddress = 'test@gitpoap.io';
const testActiveToken = '1q2w3e4r5t6y7u8i9o0p';

const addressRecord = {
  id: addressId,
  ethAddress: address,
  ensName,
  ensAvatarImageUrl,
  createdAt: new Date(),
  updatedAt: new Date(),
  githubUserId: null,
  emailId: null,
};

function mockJwtWithAddress() {
  contextMock.prisma.authToken.findUnique.mockResolvedValue({
    id: authTokenId,
    address: { ensName, ensAvatarImageUrl },
  } as any);
}

function genAuthTokens() {
  return generateAuthTokens(
    authTokenId,
    authTokenGeneration,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    null,
    null,
  );
}

describe('GET /email', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .get('/email')
      .send();

    expect(result.statusCode).toEqual(400);
  });

  it('Fails on bad address - no associated token found', async () => {
    contextMock.prisma.authToken.findUnique.mockResolvedValue(null);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .get('/email')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(401);
  });

  it('Returns valid email response', async () => {
    mockJwtWithAddress();
    contextMock.prisma.email.findUnique.mockResolvedValue({
      id: 1,
      emailAddress: 'test@gitpoap.io',
      isValidated: true,
      tokenExpiresAt: new Date(),
    } as any);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .get('/email')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledWith({
      where: { addressId: addressRecord.id },
      select: { id: true, emailAddress: true, isValidated: true, tokenExpiresAt: true },
    });
  });
});

describe('POST /email', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .post('/email')
      .send();

    expect(result.statusCode).toEqual(400);
  });

  it('Fails on bad address - no associated token found', async () => {
    contextMock.prisma.authToken.findUnique.mockResolvedValue(null);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/email')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ emailAddress: testEmailAddress });

    expect(result.statusCode).toEqual(401);
  });

  it('Fails on empty body', async () => {
    mockJwtWithAddress();

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/email')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(400);
  });

  it('Fails on bad fields in request', async () => {
    mockJwtWithAddress();

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/email')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ foobar: 'yeet' });

    expect(result.statusCode).toEqual(400);
  });

  it('returns TAKEN if email is taken.', async () => {
    mockJwtWithAddress();

    contextMock.prisma.email.findUnique.mockResolvedValue({
      id: 1,
      isValidated: true,
      tokenExpiresAt: DateTime.now().toJSDate(),
    } as any);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/email')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ emailAddress: testEmailAddress });

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledWith({
      where: { emailAddress: testEmailAddress },
      select: {
        id: true,
        isValidated: true,
        tokenExpiresAt: true,
      },
    });
  });

  it('returns TAKEN if email is pending.', async () => {
    mockJwtWithAddress();

    contextMock.prisma.email.findUnique.mockResolvedValue({
      id: 1,
      isValidated: false,
      tokenExpiresAt: DateTime.now().plus({ hour: 4 }).toJSDate(),
    } as any);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/email')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ emailAddress: testEmailAddress });

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledWith({
      where: { emailAddress: testEmailAddress },
      select: {
        id: true,
        isValidated: true,
        tokenExpiresAt: true,
      },
    });
  });

  it('Returns 500 if the email upsert fails', async () => {
    mockJwtWithAddress();

    contextMock.prisma.email.findUnique.mockResolvedValue({} as any);
    mockedUpsertUnverifiedEmail.mockResolvedValue(null);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/email')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ emailAddress: testEmailAddress });

    expect(result.statusCode).toEqual(500);
    expect(result.body).toEqual({ msg: 'Failed to setup email address' });

    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledWith({
      where: { emailAddress: testEmailAddress },
      select: {
        id: true,
        isValidated: true,
        tokenExpiresAt: true,
      },
    });

    expect(mockedUpsertUnverifiedEmail).toHaveBeenCalledTimes(1);
    expect(mockedUpsertUnverifiedEmail).toHaveBeenCalledWith(
      testEmailAddress,
      testActiveToken,
      expect.any(Date),
      addressRecord.id,
    );
  });

  it('returns 500 if the verification email fails to send.', async () => {
    mockJwtWithAddress();

    contextMock.prisma.email.findUnique.mockResolvedValue({} as any);
    mockedUpsertUnverifiedEmail.mockResolvedValue({} as any);
    mockedSendVerificationEmail.mockImplementation(() => {
      throw new Error('Failed to send email');
    });

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/email')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ emailAddress: testEmailAddress });

    expect(result.statusCode).toEqual(500);

    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledWith({
      where: { emailAddress: testEmailAddress },
      select: {
        id: true,
        isValidated: true,
        tokenExpiresAt: true,
      },
    });

    expect(mockedUpsertUnverifiedEmail).toHaveBeenCalledTimes(1);
    expect(mockedUpsertUnverifiedEmail).toHaveBeenCalledWith(
      testEmailAddress,
      testActiveToken,
      expect.any(Date),
      addressRecord.id,
    );

    expect(mockedSendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(mockedSendVerificationEmail).toHaveBeenCalledWith(testEmailAddress, testActiveToken);
  });

  it('successfully creates a new email record', async () => {
    mockJwtWithAddress();

    contextMock.prisma.email.findUnique.mockResolvedValue({} as any);
    mockedUpsertUnverifiedEmail.mockResolvedValue({} as any);
    mockedSendVerificationEmail.mockResolvedValue({} as any);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post('/email')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ emailAddress: testEmailAddress });

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledWith({
      where: { emailAddress: testEmailAddress },
      select: {
        id: true,
        isValidated: true,
        tokenExpiresAt: true,
      },
    });

    expect(mockedUpsertUnverifiedEmail).toHaveBeenCalledTimes(1);
    expect(mockedUpsertUnverifiedEmail).toHaveBeenCalledWith(
      testEmailAddress,
      testActiveToken,
      expect.any(Date),
      addressRecord.id,
    );

    expect(mockedSendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(mockedSendVerificationEmail).toHaveBeenCalledWith(testEmailAddress, testActiveToken);
  });
});

describe('DELETE /email', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .delete('/email')
      .send();

    expect(result.statusCode).toEqual(400);
  });

  it('Fails on bad address - no associated token found', async () => {
    contextMock.prisma.authToken.findUnique.mockResolvedValue(null);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .delete('/email')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(401);
  });

  it('successfully deletes an email record', async () => {
    mockJwtWithAddress();

    contextMock.prisma.email.delete.mockResolvedValue({} as any);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .delete('/email')
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.email.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.email.update).toHaveBeenCalledWith({
      where: { addressId: addressRecord.id },
      data: {
        activeToken: null,
        addressId: null,
        isValidated: false,
        tokenExpiresAt: null,
      },
    });
  });
});

describe('POST /email/verify/:activeToken', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .post(`/email/verify/${testActiveToken}`)
      .send();

    expect(result.statusCode).toEqual(400);
  });

  it('Fails on bad address - no associated token found', async () => {
    contextMock.prisma.authToken.findUnique.mockResolvedValue(null);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post(`/email/verify/${testActiveToken}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(401);
  });

  it('Fails when tokenExpiresAt is null', async () => {
    mockJwtWithAddress();

    contextMock.prisma.email.findUnique.mockResolvedValue({
      id: 1,
      isValidated: false,
      tokenExpiresAt: null,
    } as any);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post(`/email/verify/${testActiveToken}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(500);

    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledWith({
      where: { activeToken: testActiveToken },
      select: { id: true, isValidated: true, tokenExpiresAt: true },
    });
    expect(contextMock.prisma.email.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.email.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        activeToken: null,
        addressId: null,
        tokenExpiresAt: null,
      },
    });
  });

  it('Fails on invalid activeToken', async () => {
    mockJwtWithAddress();

    contextMock.prisma.email.findUnique.mockResolvedValue(null);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post(`/email/verify/${testActiveToken}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(404);

    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledWith({
      where: { activeToken: testActiveToken },
      select: { id: true, isValidated: true, tokenExpiresAt: true },
    });
  });

  it('Fails on token already validated', async () => {
    mockJwtWithAddress();

    contextMock.prisma.email.findUnique.mockResolvedValue({
      id: 1,
      isValidated: true,
      tokenExpiresAt: new Date(),
    } as any);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post(`/email/verify/${testActiveToken}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledWith({
      where: { activeToken: testActiveToken },
      select: { id: true, isValidated: true, tokenExpiresAt: true },
    });
  });

  it('Fails on token is expired', async () => {
    mockJwtWithAddress();

    contextMock.prisma.email.findUnique.mockResolvedValue({
      id: 1,
      isValidated: false,
      tokenExpiresAt: DateTime.now().minus({ day: 1 }).toJSDate(),
    } as any);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post(`/email/verify/${testActiveToken}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(401);

    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledWith({
      where: { activeToken: testActiveToken },
      select: { id: true, isValidated: true, tokenExpiresAt: true },
    });
    expect(contextMock.prisma.email.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.email.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        activeToken: null,
        addressId: null,
        tokenExpiresAt: null,
      },
    });
  });

  it('Successfully verifies an email', async () => {
    mockJwtWithAddress();

    contextMock.prisma.email.findUnique.mockResolvedValue({
      id: 1,
      isValidated: false,
      tokenExpiresAt: DateTime.now().plus({ day: 1 }).toJSDate(),
    } as any);

    const authTokens = genAuthTokens();

    const result = await request(await setupApp())
      .post(`/email/verify/${testActiveToken}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ activeToken: testActiveToken });

    expect(result.statusCode).toEqual(200);

    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.email.findUnique).toHaveBeenCalledWith({
      where: { activeToken: testActiveToken },
      select: { id: true, isValidated: true, tokenExpiresAt: true },
    });
    expect(contextMock.prisma.email.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.email.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isValidated: true },
    });
  });
});
