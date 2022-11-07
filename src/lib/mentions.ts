import { GithubMention } from '@prisma/client';
import { context } from '../context';
import { createScopedLogger } from '../logging';
import { PullRequestContribution, IssueContribution } from './contributions';

type ContributionReference = PullRequestContribution | IssueContribution;

export async function upsertGithubMention(
  repoId: number,
  contribution: ContributionReference,
  githubUserId: number,
): Promise<GithubMention> {
  const logger = createScopedLogger('upsertGithubMention');

  let pullRequestId = null;
  let issueId = null;
  let pullRequest = undefined;
  let issue = undefined;
  let where;

  if ('pullRequest' in contribution) {
    pullRequestId = contribution.pullRequest.id;

    logger.info(
      `Upserting GitHub mention for GithubUser ID ${githubUserId} in PR ID ${pullRequestId}`,
    );

    where = {
      repoId_githubUserId_pullRequestId: {
        repoId,
        githubUserId,
        pullRequestId,
      },
    };

    pullRequest = {
      connect: {
        id: pullRequestId,
      },
    };
  } else {
    // 'issue' in contribution
    issueId = contribution.issue.id;

    logger.info(
      `Upserting GitHub mention for GithubUser ID ${githubUserId} in Issue ID ${issueId}`,
    );

    where = {
      repoId_githubUserId_issueId: {
        repoId,
        githubUserId,
        issueId,
      },
    };

    issue = {
      connect: {
        id: issueId,
      },
    };
  }

  return await context.prisma.githubMention.upsert({
    where,
    update: {},
    create: {
      // Set githubMentionedAt to now
      githubMentionedAt: new Date(),
      repo: {
        connect: {
          id: repoId,
        },
      },
      githubUser: {
        connect: {
          id: githubUserId,
        },
      },
      pullRequest,
      issue,
    },
  });
}
