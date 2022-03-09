import { Router } from 'express';
import {
  GH_APP_CLIENT_ID,
  GH_APP_CLIENT_SECRET,
  GH_APP_REDIRECT_URL,
  JWT_EXP_TIME,
} from '../constants';
import fetch from 'cross-fetch';
import { sign } from 'jsonwebtoken';
import { v4 } from 'uuid';
import { context } from '../context';
import { User } from '@generated/type-graphql';

export const githubRouter = Router();

async function retrieveGithubToken(code: string): Promise<string> {
  // Request to GitHub -> exchange code (from request body) for a GitHub access token
  const body = {
    client_id: GH_APP_CLIENT_ID,
    client_secret: GH_APP_CLIENT_SECRET,
    code,
    redirect_uri: GH_APP_REDIRECT_URL,
  };

  const tokenResponse = await fetch(`https://github.com/login/oauth/access_token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const tokenJson = await tokenResponse.json();
  console.log('Token JSON: ', tokenJson);
  if (tokenJson?.error) {
    /* don't use JSON.stringify long term here */
    throw JSON.stringify(tokenJson);
  }

  return tokenJson.access_token;
}

async function retrieveGithubUserInfo(githubToken: string) {
  const userResponse = await fetch(`https://api.github.com/user`, {
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  if (userResponse.status >= 400) {
    console.log(await userResponse.text());
    return null;
  }

  return await userResponse.json();
}

function generateAccessToken(user: User, githubToken: string): string {
  return sign({ githubId: user.githubId, githubToken }, process.env.JWT_SECRET as string, {
    expiresIn: JWT_EXP_TIME,
  });
}

function generateRefreshToken(user: User) {
  // Generate a random key
  const secret = v4();

  const token = sign({ githubId: user.githubId, secret }, process.env.JWT_SECRET as string);

  return { token, secret };
}

githubRouter.post('/', async function (req, res) {
  let { code } = req.body;

  // Remove state string if it exists
  const andIndex = code.indexOf('&');
  if (andIndex !== -1) {
    code = code.substr(0, andIndex);
  }

  console.log('GitHub code: ', code);
  let githubToken = null;

  try {
    githubToken = await retrieveGithubToken(code);
  } catch (error) {
    console.error('An error has occurred', error);
    return res.status(400).send({
      message: 'A server error has occurred - GitHub access token exchange',
      error: JSON.parse(error as string),
    });
  }

  const githubUser = await retrieveGithubUserInfo(githubToken);
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

  const refreshData = generateRefreshToken(user);

  await context.prisma.authToken.create({
    data: {
      generation: user.nextGeneration,
      oauthToken: githubToken,
      refreshSecret: refreshData.secret,
      user: {
        connect: {
          githubId: user.githubId,
        },
      },
    },
  });

  await context.prisma.user.update({
    where: {
      githubId: user.githubId,
    },
    data: {
      nextGeneration: user.nextGeneration + 1,
    },
  });

  return res.status(200).json({
    accessToken: generateAccessToken(user, githubToken),
    refreshToken: refreshData.token,
  });
});
