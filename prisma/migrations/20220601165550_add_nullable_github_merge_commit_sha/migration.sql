-- AlterTable
ALTER TABLE "GitPOAP" ALTER COLUMN "lastPRUpdatedAt" SET DEFAULT date_trunc('year', now());

-- AlterTable
ALTER TABLE "GithubPullRequest" ADD COLUMN     "githubMergeCommitSha" VARCHAR(41);
