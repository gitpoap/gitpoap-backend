import fetch from 'cross-fetch';
import {
  GITHUB_URL,
  GITHUB_APP_CLIENT_ID,
  GITHUB_APP_CLIENT_SECRET,
  GITHUB_APP_REDIRECT_URL,
} from '../environment';
import { createScopedLogger } from '../logging';
import { context } from '../context';
import { SECONDS_PER_HOUR } from '../constants';
import { App, Octokit } from 'octokit';
import { createOAuthAppAuth } from '@octokit/auth-oauth-app';

/** -- Octokit Types */
type OctokitRest = App['octokit']['rest'];

export type AppsAPI = OctokitRest['apps'];
export type UsersAPI = OctokitRest['users'];
export type PullsAPI = OctokitRest['pulls'];
export type IssuesAPI = OctokitRest['issues'];
export type ReposAPI = OctokitRest['repos'];
export type OrgsAPI = OctokitRest['orgs'];

type OctokitPullList = OctokitResponseData<PullsAPI['list']>;
export type OctokitPullListItem = OctokitPullList[number];
export type OctokitPullItem = OctokitResponseData<PullsAPI['get']>;

export type OctokitRepoItem = OctokitResponseData<ReposAPI['get']>;

export type OctokitResponseData<T> = T extends (...arg0: any) => Promise<any>
  ? Awaited<ReturnType<T>>['data']
  : T;

async function responseHandler<T>(responsePromise: Promise<any>): Promise<T | null> {
  const logger = createScopedLogger('responseHandler');

  try {
    return (await responsePromise).data;
  } catch (err) {
    logger.error(`Received bad response from octokit: ${err}`);

    return null;
  }
}

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
function getOAuthAppOctokit() {
  /* Get an Octokit instance that is authenticated as the GitHub OAUTH App with clientSecret and clientId */
  return new Octokit({
    authStrategy: createOAuthAppAuth,
    auth: {
      clientId: GITHUB_APP_CLIENT_ID,
      clientSecret: GITHUB_APP_CLIENT_SECRET,
    },
  });
}

function getOAuthUserOctokit(githubOAuthToken: string) {
  return new Octokit({ auth: githubOAuthToken });
}

function getJWTAuthOctokit(jwtToken: string) {
  return new Octokit({
    auth: jwtToken,
  });
}

/** -- External Functions -- **/
export async function getGithubCurrentUserInfo(githubToken: string) {
  return await responseHandler<OctokitResponseData<UsersAPI['getByUsername']>>(
    getOAuthUserOctokit(githubToken).rest.users.getAuthenticated(),
  );
}

export async function getGithubUser(githubHandle: string, githubToken: string) {
  return await responseHandler<OctokitResponseData<UsersAPI['getByUsername']>>(
    getOAuthUserOctokit(githubToken).rest.users.getByUsername({
      username: githubHandle,
    }),
  );
}

export async function getGithubUserAsAdmin(githubHandle: string) {
  return await responseHandler<OctokitResponseData<UsersAPI['getByUsername']>>(
    getOAuthAppOctokit().rest.users.getByUsername({
      username: githubHandle,
    }),
  );
}

export async function getGithubUserById(githubId: number, githubToken: string) {
  return await responseHandler<OctokitResponseData<UsersAPI['getByUsername']>>(
    getOAuthUserOctokit(githubToken).request('GET /user/{githubId}', {
      githubId,
    }),
  );
}

export async function getGithubUserByIdAsAdmin(githubId: number) {
  return await responseHandler<OctokitResponseData<UsersAPI['getByUsername']>>(
    getOAuthAppOctokit().request('GET /user/{githubId}', {
      githubId,
    }),
  );
}

export async function getGithubRepository(organization: string, name: string, githubToken: string) {
  return await responseHandler<OctokitRepoItem>(
    getOAuthUserOctokit(githubToken).rest.repos.get({
      owner: organization,
      repo: name,
    }),
  );
}

export async function getGithubRepositoryById(repoId: number, githubToken: string) {
  return await responseHandler<OctokitRepoItem>(
    getOAuthUserOctokit(githubToken).request('GET /repositories/{repoId}', {
      repoId,
    }),
  );
}

async function getGithubRepositoryByIdAsAdmin(repoId: number) {
  return await responseHandler<OctokitRepoItem>(
    getOAuthAppOctokit().request('GET /repositories/{repoId}', {
      repoId,
    }),
  );
}

async function getGithubRepositoryStarCountAsAdmin(repoId: number) {
  const githubResponse = await getGithubRepositoryByIdAsAdmin(repoId);

  if (githubResponse === null) {
    // If the something went wrong just return 0
    return 0;
  }

  return githubResponse.stargazers_count;
}

const GITHUB_STARS_COUNT_CACHE_PREFIX = 'github#stars';
const GITHUB_STARS_COUNT_CACHE_TTL = 6 * SECONDS_PER_HOUR; // 6 hours

export async function getGithubRepositoryStarCount(repoId: number) {
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

  void context.redis.setValue(
    GITHUB_STARS_COUNT_CACHE_PREFIX,
    repoId.toString(),
    starsCount.toString(),
    GITHUB_STARS_COUNT_CACHE_TTL,
  );

  return starsCount;
}

async function isOrganizationAUser(githubHandle: string, githubToken: string) {
  const response = await getGithubUser(githubHandle, githubToken);

  if (response === null) {
    return null;
  }

  return response.type === 'User';
}

export async function getGithubOrganizationAdmins(organization: string, githubToken: string) {
  const isAUser = await isOrganizationAUser(organization, githubToken);

  if (isAUser === null) {
    return null;
  }

  if (isAUser) {
    // If the organization is actually a user, only allow that user to update the org info
    return [{ login: organization }];
  } else {
    return await responseHandler<OctokitResponseData<OrgsAPI['listMembers']>>(
      getOAuthUserOctokit(githubToken).rest.orgs.listMembers({
        org: organization,
        role: 'admin',
      }),
    );
  }
}

// This should only be used for our background processes
export async function getGithubRepositoryPullsAsAdmin(
  org: string,
  repo: string,
  perPage: number,
  page: number,
  direction: 'asc' | 'desc',
) {
  return (
    (await responseHandler<OctokitPullList>(
      getOAuthAppOctokit().rest.pulls.list({
        owner: org,
        repo,
        state: 'closed',
        sort: 'updated',
        direction,
        per_page: perPage,
        page,
      }),
    )) ?? []
  );
}

/* Get single pull request data */
export async function getSingleGithubRepositoryPullAsAdmin(
  org: string,
  repo: string,
  pullRequestNumber: number,
) {
  return await responseHandler<OctokitPullItem>(
    getOAuthAppOctokit().rest.pulls.get({
      owner: org,
      repo,
      pull_number: pullRequestNumber,
    }),
  );
}

export async function getSingleGithubRepositoryIssueAsAdmin(
  org: string,
  repo: string,
  issueNumber: number,
) {
  return await responseHandler<OctokitResponseData<IssuesAPI['get']>>(
    getOAuthAppOctokit().rest.issues.get({
      owner: org,
      repo,
      issue_number: issueNumber,
    }),
  );
}

export async function getGithubAuthenticatedApp(jwtToken: string) {
  return await responseHandler<OctokitResponseData<AppsAPI['getAuthenticated']>>(
    getJWTAuthOctokit(jwtToken).rest.apps.getAuthenticated(),
  );
}

/* -- Token Utils -- */
export async function isGithubTokenValidForUser(githubToken: string | null, githubId: number) {
  if (githubToken === null) {
    return false;
  }

  const githubUser = await getGithubCurrentUserInfo(githubToken);

  return githubUser !== null && githubUser.id === githubId;
}
