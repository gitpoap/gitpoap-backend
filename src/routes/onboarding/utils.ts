import { Octokit } from 'octokit';
import { PullRequestsRes, Repo } from './types';

export const formatRepos = (repos: Repo[]) => {
  let response = `${repos[0].full_name.split('/')[1]}`;
  for (let i = 1; i < repos.length; i++) {
    if (i + 1 === repos.length) {
      response += `, and ${repos[i].full_name.split('/')[1]}`;
    } else if (i < 5) {
      response += `, ${repos[i].full_name.split('/')[1]}`;
    } else {
      response += `, and ${repos.length - 5} more`;
      break;
    }
  }
  return response;
};

export const getMappedOrgRepo = (
  repo: Awaited<ReturnType<Octokit['rest']['repos']['listForOrg']>>['data'][number],
): Repo => ({
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
});

export const getMappedRepo = (
  repo: Awaited<ReturnType<Octokit['rest']['repos']['listForAuthenticatedUser']>>['data'][number],
): Repo => ({
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
});

export const getMappedPrRepo = (pr: PullRequestsRes['search']['edges'][number]): Repo => ({
  name: pr.node.repository.name,
  full_name: pr.node.repository.nameWithOwner,
  githubRepoId: pr.node.repository.databaseId,
  description: pr.node.repository.description,
  url: pr.node.repository.url,
  owner: {
    id: pr.node.repository.owner.id,
    name: pr.node.repository.owner.login,
    type: pr.node.repository.owner.__typename,
    avatar_url: pr.node.repository.owner.avatarUrl,
    url: pr.node.repository.owner.resourcePath,
  },
  permissions: {
    admin: ['ADMIN'].includes(pr.node.repository.viewerPermission),
    maintain: ['MAINTAIN', 'ADMIN'].includes(pr.node.repository.viewerPermission),
    push: ['WRITE', 'MAINTAIN', 'ADMIN'].includes(pr.node.repository.viewerPermission),
    triage: ['TRIAGE', 'WRITE', 'MAINTAIN', 'ADMIN'].includes(pr.node.repository.viewerPermission),
    pull: ['READ', 'WRITE', 'MAINTAIN', 'ADMIN'].includes(pr.node.repository.viewerPermission),
  },
});
