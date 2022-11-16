import { context } from '../context';
import { JWT_EXP_TIME_SECONDS } from '../constants';
import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '../environment';
import { AccessTokenPayload, RefreshTokenPayload, UserAuthTokens } from '../types/authTokens';

async function createAuthToken(addressId: number): Promise<{ id: number; generation: number }> {
  return await context.prisma.authToken.create({
    data: {
      address: {
        connect: {
          id: addressId,
        },
      },
    },
    select: {
      id: true,
      generation: true,
    },
  });
}

function generateAccessToken(payload: AccessTokenPayload): string {
  return sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXP_TIME_SECONDS,
  });
}

function generateRefreshToken(payload: RefreshTokenPayload) {
  return sign(payload, JWT_SECRET);
}

export function generateAuthTokens(
  authTokenId: number,
  authTokenGeneration: number,
  addressId: number,
  address: string,
  ensName: string | null,
  ensAvatarImageUrl: string | null,
  githubId: number | null,
  githubHandle: string | null,
  emailId: number | null,
): UserAuthTokens {
  const accessTokenPayload: AccessTokenPayload = {
    authTokenId,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    githubId,
    githubHandle,
    emailId,
  };
  const refreshTokenPayload: RefreshTokenPayload = {
    authTokenId,
    addressId,
    generation: authTokenGeneration,
  };

  return {
    accessToken: generateAccessToken(accessTokenPayload),
    refreshToken: generateRefreshToken(refreshTokenPayload),
  };
}

export async function generateNewAuthTokens(
  addressId: number,
  address: string,
  ensName: string | null,
  ensAvatarImageUrl: string | null,
  githubId: number | null,
  githubHandle: string | null,
  emailId: number | null,
): Promise<UserAuthTokens> {
  const authToken = await createAuthToken(addressId);

  return generateAuthTokens(
    authToken.id,
    authToken.generation,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    githubId,
    githubHandle,
    emailId,
  );
}

export async function deleteAuthToken(authTokenId: number) {
  await context.prisma.authToken.delete({
    where: {
      id: authTokenId,
    },
  });
}
