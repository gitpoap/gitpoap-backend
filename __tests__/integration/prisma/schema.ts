import { context } from '../../../src/context';

describe('prisma/schema assumptions', () => {
  it('Allows creating multiple GithubMention records with issueId = null', async () => {
    const pullRequests = await context.prisma.githubPullRequest.findMany({
      take: 2,
      select: {
        id: true,
      },
    });

    // Expect that there's at least 2 GithubPullRequests already in the DB
    expect(pullRequests.length).toEqual(2);

    const mention1 = await context.prisma.githubMention.create({
      data: {
        githubMentionedAt: new Date(),
        pullRequest: {
          connect: {
            id: pullRequests[0].id,
          },
        },
        user: {
          connect: {
            id: 1,
          },
        },
        repo: {
          connect: {
            id: 1,
          },
        },
      },
    });

    const mention2 = await context.prisma.githubMention.create({
      data: {
        githubMentionedAt: new Date(),
        pullRequest: {
          connect: {
            id: pullRequests[1].id,
          },
        },
        user: {
          connect: {
            id: 1,
          },
        },
        repo: {
          connect: {
            id: 1,
          },
        },
      },
    });

    // Cleanup
    await context.prisma.githubMention.deleteMany({
      where: {
        id: {
          in: [mention1.id, mention2.id],
        },
      },
    });
  });

  it('Allows creating multiple GithubMention records with issueId = null', async () => {
    const issue1 = await context.prisma.githubIssue.create({
      data: {
        githubCreatedAt: new Date(),
        githubIssueNumber: 234,
        githubTitle: 'Big Issue',
        user: {
          connect: {
            id: 3,
          },
        },
        repo: {
          connect: {
            id: 1,
          },
        },
      },
    });
    const issue2 = await context.prisma.githubIssue.create({
      data: {
        githubCreatedAt: new Date(),
        githubIssueNumber: 34,
        githubTitle: 'Small Issue',
        user: {
          connect: {
            id: 1,
          },
        },
        repo: {
          connect: {
            id: 1,
          },
        },
      },
    });

    const mention1 = await context.prisma.githubMention.create({
      data: {
        githubMentionedAt: new Date(),
        issue: {
          connect: {
            id: issue1.id,
          },
        },
        user: {
          connect: {
            id: 1,
          },
        },
        repo: {
          connect: {
            id: 1,
          },
        },
      },
    });

    const mention2 = await context.prisma.githubMention.create({
      data: {
        githubMentionedAt: new Date(),
        issue: {
          connect: {
            id: issue2.id,
          },
        },
        user: {
          connect: {
            id: 1,
          },
        },
        repo: {
          connect: {
            id: 1,
          },
        },
      },
    });

    // Cleanup
    await context.prisma.githubMention.deleteMany({
      where: {
        id: {
          in: [mention1.id, mention2.id],
        },
      },
    });
    await context.prisma.githubIssue.deleteMany({
      where: {
        id: {
          in: [issue1.id, issue2.id],
        },
      },
    });
  });
});
