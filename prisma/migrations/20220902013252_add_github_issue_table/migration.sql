-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "issueEarnedId" INTEGER;

-- CreateTable
CREATE TABLE "GithubIssue" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "githubIssueNumber" INTEGER NOT NULL,
    "githubTitle" TEXT NOT NULL,
    "githubClosedAt" TIMESTAMP(3),
    "repoId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "prClosedById" INTEGER,

    CONSTRAINT "GithubIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GithubIssue_repoId_githubIssueNumber_key" ON "GithubIssue"("repoId", "githubIssueNumber");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_issueEarnedId_fkey" FOREIGN KEY ("issueEarnedId") REFERENCES "GithubIssue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubIssue" ADD CONSTRAINT "GithubIssue_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubIssue" ADD CONSTRAINT "GithubIssue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubIssue" ADD CONSTRAINT "GithubIssue_prClosedById_fkey" FOREIGN KEY ("prClosedById") REFERENCES "GithubPullRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
