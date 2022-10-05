import { context } from '../context';
import { upsertUser } from '../lib/users';
import { JWT_EXP_TIME } from '../constants';
import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '../environment';
import { AccessTokenPayload, RefreshTokenPayload } from '../types/tokens';

async function createAuthToken(addressId: number, githubId: number | null) {
  let user = undefined;
  if (githubId !== null) {
    user = {
      connect: {
        id: githubId,
      },
    };
  }

  return await context.prisma.authToken.create({
    data: {
      address: {
        connect: {
          id: addressId,
        },
      },
      user,
    },
  });
}

function generateAccessToken(payload: AccessTokenPayload): string {
  return sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXP_TIME,
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
) {
  const accessTokenPayload: AccessTokenPayload = {
    authTokenId,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    githubId,
    githubHandle,
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
) {
  const authToken = await createAuthToken(addressId, githubId);

  return generateAuthTokens(
    authToken.id,
    authToken.generation,
    addressId,
    address,
    ensName,
    ensAvatarImageUrl,
    githubId,
    githubHandle,
  );
}
