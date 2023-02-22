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

export type OctokitResponseData<T> = T extends (...args: any[]) => Promise<infer U>
  ? U extends { data: unknown }
    ? U['data']
    : never
  : never;

async function responseHandler<T>(
  methodName: string,
  requestorGithubHandle: string,
  responsePromise: Promise<any>,
): Promise<T | null> {
  const logger = createScopedLogger(`responseHandler[${methodName}]`);

  try {
    return (await responsePromise).data;
  } catch (err) {
    logger.error(`Received bad response from octokit for user ${requestorGithubHandle}: ${err}`);

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
export function getOAuthAppOctokit() {
  /* Get an Octokit instance that is authenticated as the GitHub OAUTH App with clientSecret and clientId */
  return new Octokit({
    authStrategy: createOAuthAppAuth,
    auth: {
      clientId: GITHUB_APP_CLIENT_ID,
      clientSecret: GITHUB_APP_CLIENT_SECRET,
    },
  });
}

function getJWTAuthOctokit(jwtToken: string) {
  return new Octokit({
    auth: jwtToken,
  });
}

/** -- External Functions -- **/
export async function getGithubUserAsApp(githubHandle: string) {
  return await responseHandler<OctokitResponseData<UsersAPI['getByUsername']>>(
    `getGithubUserAsApp(${githubHandle})`,
    '[APP]',
    getOAuthAppOctokit().rest.users.getByUsername({
      username: githubHandle,
    }),
  );
}

export async function getGithubUserByIdAsApp(githubId: number) {
  return await responseHandler<OctokitResponseData<UsersAPI['getByUsername']>>(
    `getGithubUserByIdAsApp${githubId})`,
    '[APP]',
    getOAuthAppOctokit().request('GET /user/{githubId}', {
      githubId,
    }),
  );
}

export async function getGithubRepositoryAsApp(organization: string, name: string) {
  return await responseHandler<OctokitRepoItem>(
    `getGithubRepository(${organization}/${name})`,
    '[APP]',
    getOAuthAppOctokit().rest.repos.get({
      owner: organization,
      repo: name,
    }),
  );
}

export async function getGithubRepositoryByIdAsApp(repoId: number) {
  return await responseHandler<OctokitRepoItem>(
    `getGithubRepositoryByIdAsApp(${repoId})`,
    '[APP]',
    getOAuthAppOctokit().request('GET /repositories/{repoId}', {
      repoId,
    }),
  );
}

async function getGithubRepositoryStarCountAsApp(repoId: number) {
  const githubResponse = await getGithubRepositoryByIdAsApp(repoId);

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

  const starsCount = await getGithubRepositoryStarCountAsApp(repoId);

  void context.redis.setValue(
    GITHUB_STARS_COUNT_CACHE_PREFIX,
    repoId.toString(),
    starsCount.toString(),
    GITHUB_STARS_COUNT_CACHE_TTL,
  );

  return starsCount;
}

async function isOrganizationAUserAsApp(githubHandle: string) {
  const response = await getGithubUserAsApp(githubHandle);

  if (response === null) {
    return null;
  }

  return response.type === 'User';
}

export async function getGithubOrganizationAdminsAsApp(organization: string) {
  const isAUser = await isOrganizationAUserAsApp(organization);

  if (isAUser === null) {
    return null;
  }

  if (isAUser) {
    // If the organization is actually a user, only allow that user to update the org info
    return [{ login: organization }];
  } else {
    return await responseHandler<OctokitResponseData<OrgsAPI['listMembers']>>(
      `getGithubOrganizationAdmins(${organization})`,
      '[APP]',
      getOAuthAppOctokit().rest.orgs.listMembers({
        org: organization,
        role: 'admin',
      }),
    );
  }
}

// This should only be used for our background processes
export async function getGithubRepositoryPullsAsApp(
  org: string,
  repo: string,
  perPage: number,
  page: number,
  direction: 'asc' | 'desc',
) {
  return (
    (await responseHandler<OctokitPullList>(
      `getGithubRepositoryPullsAsApp(${org}/${repo}, page: ${page}, perPage: ${perPage}, direction: ${direction})`,
      '[APP]',
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
export async function getSingleGithubRepositoryPullAsApp(
  org: string,
  repo: string,
  pullRequestNumber: number,
) {
  return await responseHandler<OctokitPullItem>(
    `getSingleGithubRepositoryPullAsApp(${org}/${repo}, number: ${pullRequestNumber})`,
    '[APP]',
    getOAuthAppOctokit().rest.pulls.get({
      owner: org,
      repo,
      pull_number: pullRequestNumber,
    }),
  );
}

export async function getSingleGithubRepositoryIssueAsApp(
  org: string,
  repo: string,
  issueNumber: number,
) {
  return await responseHandler<OctokitResponseData<IssuesAPI['get']>>(
    `getSingleGithubRepositoryIssueAsApp(${org}/${repo}, number: ${issueNumber})`,
    '[APP]',
    getOAuthAppOctokit().rest.issues.get({
      owner: org,
      repo,
      issue_number: issueNumber,
    }),
  );
}

export async function getGithubAuthenticatedApp(jwtToken: string) {
  return await responseHandler<OctokitResponseData<AppsAPI['getAuthenticated']>>(
    'getGithubAuthenticatedApp',
    '[UNKNOWN BOT]',
    getJWTAuthOctokit(jwtToken).rest.apps.getAuthenticated(),
  );
}
