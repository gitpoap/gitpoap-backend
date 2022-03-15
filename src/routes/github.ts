import { Router } from 'express';
import { JWT_EXP_TIME } from '../constants';
import fetch from 'cross-fetch';
import { sign, verify } from 'jsonwebtoken';
import { context } from '../context';
import { User } from '@generated/type-graphql';
import { RequestAccessTokenSchema, RefreshAccessTokenSchema } from '../schemas/github';
import { RefreshTokenPayload } from '../types/tokens';
import { requestGithubOAuthToken, getGithubCurrentUserInfo } from '../external/github';
import { JWT_SECRET } from '../environment';

export const githubRouter = Router();

function generateAccessToken(authTokenId: number, githubId: number, githubHandle: string): string {
  return sign({ authTokenId, githubId, githubHandle }, JWT_SECRET as string, {
    expiresIn: JWT_EXP_TIME,
  });
}

function generateRefreshToken(authTokenId: number, githubId: number, generation: number) {
  return sign({ authTokenId, githubId, generation }, JWT_SECRET as string);
}

githubRouter.post('/', async function (req, res) {
  const schemaResult = RequestAccessTokenSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  let { code } = req.body;

  // Remove state string if it exists
  const andIndex = code.indexOf('&');
  if (andIndex !== -1) {
    code = code.substr(0, andIndex);
  }

  console.log('GitHub code: ', code);
  let githubToken = null;

  try {
    githubToken = await requestGithubOAuthToken(code);
  } catch (error) {
    console.error('An error has occurred', error);
    return res.status(400).send({
      message: 'A server error has occurred - GitHub access token exchange',
      error: JSON.parse(error as string),
    });
  }

  const githubUser = await getGithubCurrentUserInfo(githubToken);
  if (githubUser === null) {
    return res.status(400).send({
      message: 'A server error has occurred - GitHub current user',
    });
  }

  // Update or create the user's data
  const user = await context.prisma.user.upsert({
    where: {
      githubId: githubUser.id,
    },
    update: {
      githubHandle: githubUser.login,
    },
    create: {
      githubId: githubUser.id,
      githubHandle: githubUser.login,
    },
  });

  const authToken = await context.prisma.authToken.create({
    data: {
      githubOAuthToken: githubToken,
      user: {
        connect: {
          id: user.id,
        },
      },
    },
  });

  return res.status(200).json({
    accessToken: generateAccessToken(authToken.id, user.githubId, user.githubHandle),
    refreshToken: generateRefreshToken(authToken.id, user.githubId, authToken.generation),
  });
});

githubRouter.post('/refresh', async function (req, res) {
  const schemaResult = RefreshAccessTokenSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { token } = req.body;
  let payload: RefreshTokenPayload;
  try {
    payload = <RefreshTokenPayload>verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).send({ message: 'The refresh token is invalid' });
  }

  const authToken = await context.prisma.authToken.findUnique({
    where: {
      id: payload.authTokenId,
    },
    include: {
      user: {
        select: {
          githubHandle: true,
        },
      },
    },
  });

  if (authToken === null) {
    return res.status(401).send({ message: 'The refresh token is invalid' });
  }

  // If someone is trying to use an old generation of the refresh token, we must
  // consider the lineage to be tainted, and therefore purge it completely
  // (user will need to log back in via GitHub).
  if (payload.generation !== authToken.generation) {
    console.log(`GitHub user ${authToken.githubId} had a refresh token reused.`);
    await context.prisma.authToken.delete({
      where: {
        id: authToken.id,
      },
    });

    return res.status(401).send({ message: 'The refresh token has already been used' });
  }

  const nextGeneration = authToken.generation + 1;
  await context.prisma.authToken.update({
    where: {
      id: authToken.id,
    },
    data: {
      generation: nextGeneration,
    },
  });

  return res.status(200).json({
    accessToken: generateAccessToken(authToken.id, payload.githubId, authToken.user.githubHandle),
    refreshToken: generateRefreshToken(authToken.id, payload.githubId, nextGeneration),
  });
});
