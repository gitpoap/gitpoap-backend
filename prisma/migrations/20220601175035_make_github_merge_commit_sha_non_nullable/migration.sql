/*
  Warnings:

  - Made the column `githubMergeCommitSha` on table `GithubPullRequest` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "GitPOAP" ALTER COLUMN "lastPRUpdatedAt" SET DEFAULT date_trunc('year', now());

-- AlterTable
ALTER TABLE "GithubPullRequest" ALTER COLUMN "githubMergeCommitSha" SET NOT NULL;
