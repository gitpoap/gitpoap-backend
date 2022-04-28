/*
  Warnings:

  - A unique constraint covering the columns `[gitPOAPId,userId]` on the table `Claim` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "GitPOAP" ADD COLUMN     "lastPRUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT date_trunc('year', now());

-- CreateIndex
CREATE UNIQUE INDEX "Claim_gitPOAPId_userId_key" ON "Claim"("gitPOAPId", "userId");
