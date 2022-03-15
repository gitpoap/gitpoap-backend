import fetch from 'cross-fetch';
import { GH_APP_CLIENT_ID, GH_APP_CLIENT_SECRET, GH_APP_REDIRECT_URL } from './constants';

export async function requestGithubOAuthToken(code: string) {
  // Request to GitHub -> exchange code (from request body) for a GitHub access token
  const body = {
    client_id: GH_APP_CLIENT_ID,
    client_secret: GH_APP_CLIENT_SECRET,
    code,
    redirect_uri: GH_APP_REDIRECT_URL,
  };

  const tokenResponse = await fetch(`${process.env.GITHUB_APP_URL}/login/oauth/access_token`, {
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

async function makeGithubAPIRequest(url: string, githubToken: string) {
  try {
    const githubResponse = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/json',
      },
    });

    if (githubResponse.status >= 400) {
      console.log(await githubResponse.text());
      return null;
    }

    return await githubResponse.json();
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function getGithubCurrentUserInfo(githubToken: string) {
  return await makeGithubAPIRequest(`${process.env.GITHUB_API_URL}/user`, githubToken);
}

export async function getGithubUserById(githubId: number, githubToken: string) {
  return await makeGithubAPIRequest(`${process.env.GITHUB_API_URL}/user/${githubId}`, githubToken);
}

export async function getGithubRepository(organization: string, name: string, githubToken: string) {
  return await makeGithubAPIRequest(
    `${process.env.GITHUB_API_URL}/repos/${organization}/${name}`,
    githubToken,
  );
}
