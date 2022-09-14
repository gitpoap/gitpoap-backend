import { GithubMention } from '@prisma/client';
import { context } from '../context';
import { createScopedLogger } from '../logging';
import { PullRequestContribution, IssueContribution } from './contributions';

type ContributionReference = PullRequestContribution | IssueContribution;

export async function upsertGithubMention(
  repoId: number,
  contribution: ContributionReference,
  userId: number,
): Promise<GithubMention> {
  const logger = createScopedLogger('upsertGithubMention');

  let pullRequestId = null;
  let issueId = null;
  let pullRequest = undefined;
  let issue = undefined;
  let where;

  if ('pullRequest' in contribution) {
    pullRequestId = contribution.pullRequest.id;

    logger.info(`Upserting GitHub mention for user ID ${userId} in PR ID ${pullRequestId}`);

    where = {
      repoId_userId_pullRequestId: {
        repoId,
        userId,
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

    logger.info(`Upserting GitHub mention for user ID ${userId} in Issue ID ${issueId}`);

    where = {
      repoId_userId_issueId: {
        repoId,
        userId,
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
      // Set mentionedAt to now
      mentionedAt: new Date(),
      repo: {
        connect: {
          id: repoId,
        },
      },
      user: {
        connect: {
          id: userId,
        },
      },
      pullRequest,
      issue,
    },
  });
}
