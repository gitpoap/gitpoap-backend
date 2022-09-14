-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "mentionEarnedId" INTEGER;

-- AlterTable
ALTER TABLE "GithubPullRequest" ALTER COLUMN "githubMergedAt" DROP NOT NULL;

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

    CONSTRAINT "GithubIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubMention" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "githubMentionedAt" TIMESTAMP(3) NOT NULL,
    "repoId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "pullRequestId" INTEGER,
    "issueId" INTEGER,

    CONSTRAINT "GithubMention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GithubIssue_repoId_githubIssueNumber_key" ON "GithubIssue"("repoId", "githubIssueNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GithubMention_repoId_userId_pullRequestId_key" ON "GithubMention"("repoId", "userId", "pullRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubMention_repoId_userId_issueId_key" ON "GithubMention"("repoId", "userId", "issueId");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_mentionEarnedId_fkey" FOREIGN KEY ("mentionEarnedId") REFERENCES "GithubMention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubIssue" ADD CONSTRAINT "GithubIssue_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubIssue" ADD CONSTRAINT "GithubIssue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubMention" ADD CONSTRAINT "GithubMention_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubMention" ADD CONSTRAINT "GithubMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubMention" ADD CONSTRAINT "GithubMention_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "GithubPullRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubMention" ADD CONSTRAINT "GithubMention_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "GithubIssue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
