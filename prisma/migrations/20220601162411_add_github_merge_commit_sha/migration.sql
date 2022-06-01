/*
  Warnings:

  - Added the required column `githubMergeCommitSha` to the `GithubPullRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GitPOAP" ALTER COLUMN "lastPRUpdatedAt" SET DEFAULT date_trunc('year', now());

-- AlterTable
ALTER TABLE "GithubPullRequest" ADD COLUMN     "githubMergeCommitSha" VARCHAR(41) NOT NULL;
