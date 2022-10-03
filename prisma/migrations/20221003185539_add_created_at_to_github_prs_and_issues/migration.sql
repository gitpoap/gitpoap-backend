-- AlterTable
ALTER TABLE "GithubIssue" ADD COLUMN     "githubCreatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GithubPullRequest" ADD COLUMN     "githubCreatedAt" TIMESTAMP(3);
