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

export const githubRouter = Router();

async function retrieveGithubToken(code: string) {
  // Request to GitHub -> exchange code (from request body) for a GitHub access token
  const body = {
    client_id: GH_APP_CLIENT_ID,
    client_secret: GH_APP_CLIENT_SECRET,
    code,
    redirect_uri: GH_APP_REDIRECT_URL,
  };

  const tokenRes = await fetch(`https://github.com/login/oauth/access_token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const tokenJson = await tokenRes.json();
  console.log('Token JSON: ', tokenJson);
  if (tokenJson?.error) {
    /* don't use JSON.stringify long term here */
    throw JSON.stringify(tokenJson);
  }

  return tokenJson.access_token;
}

function generateAccessToken(githubToken: string) {
  return sign({ githubToken }, process.env.JWT_SECRET as string, {
    expiresIn: JWT_EXP_TIME,
  });
}

function generateRefreshToken() {
  // Generate a random key
  const secret = v4();

  return sign({ secret }, process.env.JWT_SECRET as string);
}

githubRouter.post('/', async function (req, res) {
  const { code } = req.body;
  console.log(req.body);

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

  return res.status(200).json({
    accessToken: generateAccessToken(githubToken),
    refreshToken: generateRefreshToken(),
  });
});
