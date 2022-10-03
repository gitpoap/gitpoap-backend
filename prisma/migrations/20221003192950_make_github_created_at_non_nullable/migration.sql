/*
  Warnings:

  - Made the column `githubCreatedAt` on table `GithubIssue` required. This step will fail if there are existing NULL values in that column.
  - Made the column `githubCreatedAt` on table `GithubPullRequest` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "GithubIssue" ALTER COLUMN "githubCreatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "GithubPullRequest" ALTER COLUMN "githubCreatedAt" SET NOT NULL;
