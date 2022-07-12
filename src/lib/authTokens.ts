import { context } from '../context';
import { upsertUser } from '../lib/users';
import { JWT_EXP_TIME } from '../constants';
import { sign } from 'jsonwebtoken';
import { JWT_SECRET } from '../environment';

export async function createAuthToken(userId: number, githubToken: string) {
  return await context.prisma.authToken.create({
    data: {
      githubOAuthToken: githubToken,
      user: {
        connect: {
          id: userId,
        },
      },
    },
  });
}

function generateAccessToken(authTokenId: number, githubId: number, githubHandle: string): string {
  return sign({ authTokenId, githubId, githubHandle }, JWT_SECRET as string, {
    expiresIn: JWT_EXP_TIME,
  });
}

function generateRefreshToken(authTokenId: number, githubId: number, generation: number) {
  return sign({ authTokenId, githubId, generation }, JWT_SECRET as string);
}

export function generateAuthTokens(
  authTokenId: number,
  authTokenGeneration: number,
  githubId: number,
  githubHandle: string,
) {
  return {
    accessToken: generateAccessToken(authTokenId, githubId, githubHandle),
    refreshToken: generateRefreshToken(authTokenId, githubId, authTokenGeneration),
  };
}

export async function generateNewAuthTokens(
  githubId: number,
  githubHandle: string,
  githubToken: string,
) {
  // Update or create the user's data
  const user = await upsertUser(githubId, githubHandle);

  const authToken = await createAuthToken(user.id, githubToken);

  return generateAuthTokens(authToken.id, authToken.generation, githubId, githubHandle);
}
