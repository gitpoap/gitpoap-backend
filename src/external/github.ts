import fetch from 'cross-fetch';
import {
  GITHUB_URL,
  GITHUB_API_URL,
  GITHUB_APP_CLIENT_ID,
  GITHUB_APP_CLIENT_SECRET,
  GITHUB_APP_REDIRECT_URL,
} from '../environment';
import { createScopedLogger } from '../logging';
import { githubRequestDurationSeconds } from '../metrics';
import { URL } from 'url';
import { context } from '../context';
import { SECONDS_PER_HOUR } from '../constants';

/** -- Response Types -- **/
type GithubUserResponse = {
  login: string;
};

export type GithubPullRequestData = {
  number: number;
  title: string;
  user: {
    id: number;
    login: string;
  };
  merged_at: string;
  updated_at: string;
  merge_commit_sha: string;
  head: {
    sha: string;
  };
  base: {
    repo: {
      id: number;
    };
  };
};

export type GithubRepoResponse = {
  id: number;
  name: string;
  owner: {
    id: number;
    login: string;
  };
  stargazers_count: number;
};

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

/** -- Internal Functions -- **/
async function makeGithubAPIRequestInternal(path: string, authorization: string) {
  const logger = createScopedLogger('makeGithubAPIRequestInternal');

  const endTimer = githubRequestDurationSeconds.startTimer('GET', path);

  logger.debug(
    `Making a Github request via the ${authorization.substring(
      0,
      authorization.indexOf(' '),
    )} method`,
  );

  try {
    const githubResponse = await fetch(new URL(path, GITHUB_API_URL).href, {
      method: 'GET',
      headers: {
        Authorization: authorization,
        Accept: 'application/json',
      },
    });

    if (githubResponse.status >= 400) {
      logger.warn(
        `Bad response (${githubResponse.status}) from GitHub: ${await githubResponse.text()}`,
      );
      endTimer({ success: 0 });
      return null;
    }

    endTimer({ success: 1 });

    return await githubResponse.json();
  } catch (err) {
    logger.warn(`Error while calling GitHub: ${err}`);
    endTimer({ success: 0 });
    return null;
  }
}

async function makeGithubAPIRequest(path: string, githubToken: string) {
  return await makeGithubAPIRequestInternal(path, `token ${githubToken}`);
}

// This should only be used for our background processes
async function makeAdminGithubAPIRequest(path: string) {
  const basicAuthString = Buffer.from(
    `${GITHUB_APP_CLIENT_ID}:${GITHUB_APP_CLIENT_SECRET}`,
  ).toString('base64');

  return await makeGithubAPIRequestInternal(path, `Basic ${basicAuthString}`);
}

/** -- External Functions -- **/
export async function getGithubCurrentUserInfo(githubToken: string) {
  return await makeGithubAPIRequest(`/user`, githubToken);
}

export async function getGithubUser(githubHandle: string, githubToken: string) {
  return await makeGithubAPIRequest(`/users/${githubHandle}`, githubToken);
}

export async function getGithubUserById(
  githubId: number,
  githubToken: string,
): Promise<GithubUserResponse | null> {
  return await makeGithubAPIRequest(`/user/${githubId}`, githubToken);
}

export async function getGithubRepository(
  organization: string,
  name: string,
  githubToken: string,
): Promise<GithubRepoResponse> {
  return await makeGithubAPIRequest(`/repos/${organization}/${name}`, githubToken);
}

export async function getGithubRepositoryById(
  repoId: number,
  githubToken: string,
): Promise<GithubRepoResponse> {
  return await makeGithubAPIRequest(`/repositories/${repoId}`, githubToken);
}

async function getGithubRepositoryByIdAsAdmin(repoId: number): Promise<GithubRepoResponse> {
  return await makeAdminGithubAPIRequest(`/repositories/${repoId}`);
}

async function getGithubRepositoryStarCountAsAdmin(repoId: number): Promise<number> {
  const githubResponse = await getGithubRepositoryByIdAsAdmin(repoId);

  if (githubResponse === null) {
    // If the something went wrong just return 0
    return 0;
  }

  return githubResponse.stargazers_count;
}

const GITHUB_STARS_COUNT_CACHE_PREFIX = 'github#stars';
const GITHUB_STARS_COUNT_CACHE_TTL = 6 * SECONDS_PER_HOUR; // 6 hours

export async function getGithubRepositoryStarCount(repoId: number): Promise<number> {
  const logger = createScopedLogger('getGithubRepositoryStarCount');

  const cacheResponse = await context.redis.getValue(
    GITHUB_STARS_COUNT_CACHE_PREFIX,
    repoId.toString(),
  );

  if (cacheResponse !== null) {
    logger.debug(`Found GitHub stars count for githubRepoId ${repoId} in cache`);

    return parseInt(cacheResponse, 10);
  }

  logger.debug(`GitHub stars count for githubRepoId ${repoId} not in cache`);

  const starsCount = await getGithubRepositoryStarCountAsAdmin(repoId);

  context.redis.setValue(
    GITHUB_STARS_COUNT_CACHE_PREFIX,
    repoId.toString(),
    starsCount.toString(),
    GITHUB_STARS_COUNT_CACHE_TTL,
  );

  return starsCount;
}

export async function isOrganizationAUser(githubHandle: string, githubToken: string) {
  const response = await getGithubUser(githubHandle, githubToken);

  return response.type === 'User';
}

export async function getGithubOrganizationAdmins(
  organization: string,
  githubToken: string,
): Promise<[{ login: string }]> {
  if (await isOrganizationAUser(organization, githubToken)) {
    // If the organization is actually a user, only allow that user to update the org info
    return [{ login: organization }];
  } else {
    return await makeGithubAPIRequest(`/orgs/${organization}/members?role=admin`, githubToken);
  }
}

// This should only be used for our background processes
export async function getGithubRepositoryPullsAsAdmin(
  org: string,
  repo: string,
  perPage: number,
  page: number,
  direction: 'asc' | 'desc',
): Promise<GithubPullRequestData[]> {
  return await makeAdminGithubAPIRequest(
    `/repos/${org}/${repo}/pulls?state=closed&sort=updated&direction=${direction}&per_page=${perPage}&page=${page}`,
  );
}

/* Get single pull request data */
export const getSingleGithubRepositoryPullAsAdmin = async (
  org: string,
  repo: string,
  pullRequestNum: number,
): Promise<GithubPullRequestData> => {
  return await makeAdminGithubAPIRequest(`/repos/${org}/${repo}/pulls/${pullRequestNum}`);
};
