/*
  Warnings:

  - You are about to drop the column `gitPOAPId` on the `GitPOAPRequest` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "GitPOAPRequest" DROP CONSTRAINT "GitPOAPRequest_gitPOAPId_fkey";

-- DropIndex
DROP INDEX "GitPOAPRequest_gitPOAPId_key";

-- AlterTable
ALTER TABLE "GitPOAPRequest" DROP COLUMN "gitPOAPId";
