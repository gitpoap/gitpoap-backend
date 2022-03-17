import fetch from 'cross-fetch';
import {
  GITHUB_URL,
  GITHUB_API_URL,
  GITHUB_APP_CLIENT_ID,
  GITHUB_APP_CLIENT_SECRET,
  GITHUB_APP_REDIRECT_URL,
} from '../environment';
import { createScopedLogger } from '../logging';

export async function requestGithubOAuthToken(code: string) {
  const logger = createScopedLogger('requestGithubOAuthToken');

  // Request to GitHub -> exchange code (from request body) for a GitHub access token
  const body = {
    client_id: GITHUB_APP_CLIENT_ID,
    client_secret: GITHUB_APP_CLIENT_SECRET,
    code,
    redirect_uri: GITHUB_APP_REDIRECT_URL,
  };

  const tokenResponse = await fetch(`${GITHUB_URL}/login/oauth/access_token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const tokenJson = await tokenResponse.json();
  logger.debug(`Token JSON: ${tokenJson}`);
  if (tokenJson?.error) {
    /* don't use JSON.stringify long term here */
    throw JSON.stringify(tokenJson);
  }

  return tokenJson.access_token;
}

async function makeGithubAPIRequest(url: string, githubToken: string) {
  const logger = createScopedLogger('makeGithubAPIRequest');

  try {
    const githubResponse = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/json',
      },
    });

    if (githubResponse.status >= 400) {
      logger.warn(
        `Bad response (${githubResponse.status}) from GitHub: ${await githubResponse.text()}`,
      );
      return null;
    }

    return await githubResponse.json();
  } catch (err) {
    logger.warn(`Error while calling GitHub: ${err}`);
    return null;
  }
}

export async function getGithubCurrentUserInfo(githubToken: string) {
  return await makeGithubAPIRequest(`${GITHUB_API_URL}/user`, githubToken);
}

export async function getGithubUserById(githubId: number, githubToken: string) {
  return await makeGithubAPIRequest(`${GITHUB_API_URL}/user/${githubId}`, githubToken);
}

export async function getGithubRepository(organization: string, name: string, githubToken: string) {
  return await makeGithubAPIRequest(`${GITHUB_API_URL}/repos/${organization}/${name}`, githubToken);
}
