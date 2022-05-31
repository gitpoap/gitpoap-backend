-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "pullRequestEarnedId" INTEGER;

-- AlterTable
ALTER TABLE "GitPOAP" ALTER COLUMN "lastPRUpdatedAt" SET DEFAULT date_trunc('year', now());

-- CreateTable
CREATE TABLE "GithubPullRequest" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "githubPullNumber" INTEGER NOT NULL,
    "githubTitle" TEXT NOT NULL,
    "githubMergedAt" TIMESTAMP(3) NOT NULL,
    "githubMergeCommitSha" VARCHAR(41) NOT NULL,
    "repoId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "GithubPullRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GithubPullRequest_repoId_githubPullNumber_key" ON "GithubPullRequest"("repoId", "githubPullNumber");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_pullRequestEarnedId_fkey" FOREIGN KEY ("pullRequestEarnedId") REFERENCES "GithubPullRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubPullRequest" ADD CONSTRAINT "GithubPullRequest_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubPullRequest" ADD CONSTRAINT "GithubPullRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
