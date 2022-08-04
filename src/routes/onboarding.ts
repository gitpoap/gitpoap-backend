import { Router } from 'express';
import { Octokit } from 'octokit';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import { jwtWithOAuth } from '../middleware';
import { AccessTokenPayloadWithOAuth } from '../types/tokens';

type Repo = {
  name: string;
  full_name: string;
  githubRepoId: number;
  description: string | null;
  owner: {
    id: number;
    type: string;
    name: string;
    avatar_url: string;
    url: string;
  };
  permissions?: {
    admin: boolean; // YES
    maintain?: boolean; // YES
    push: boolean; // YES
    triage?: boolean;
    pull: boolean;
  };
};

type FormRepo = {
  full_name: string;
  githubRepoId: string;
  permissions: {
    admin: boolean; // YES
    maintain: boolean; // YES
    push: boolean; // YES
    triage: boolean;
    pull: boolean;
  };
};

type FormData = {
  name: string;
  email: string;
  notes: string;
  githubHandle: string;
  repos: FormRepo[];
};

export const onboardingRouter = Router();

onboardingRouter.get<'/github/repos', {}, Repo[]>(
  '/github/repos',
  jwtWithOAuth(),
  async function (req, res) {
    const logger = createScopedLogger('GET /onboarding/github/repos');
    const endTimer = httpRequestDurationSeconds.startTimer('GET', '/onboarding/github/repos');

    const token = (<AccessTokenPayloadWithOAuth>req.user).githubOAuthToken;
    const octokit = new Octokit({ auth: token });
    const user = await octokit.rest.users.getAuthenticated();

    logger.info(`Fetching repos list for GitHub user ${user.data.login}`);

    const repos = await octokit.rest.repos.listForAuthenticatedUser({
      type: 'public',
      per_page: 100,
    });

    const mappedRepos: Repo[] = repos.data
      .filter(repo => {
        /* no forks */
        if (repo.fork) {
          return false;
        }

        /* must have at least one of these permissions */
        if (!(repo.permissions?.admin && repo.permissions?.maintain && repo.permissions?.push)) {
          return false;
        }

        return true;
      })
      .map(repo => {
        return {
          name: repo.name,
          full_name: repo.full_name,
          githubRepoId: repo.id,
          description: repo.description,
          url: repo.html_url,
          owner: {
            id: repo.owner.id,
            type: repo.owner.type,
            name: repo.owner.login,
            avatar_url: repo.owner.avatar_url,
            url: repo.owner.html_url,
          },
          permissions: repo.permissions,
        };
      });

    logger.info(`Found ${mappedRepos.length} applicable repos for GitHub user ${user.data.login}`);

    endTimer({ status: 200 });

    return res.status(200).json(mappedRepos);
  },
);
