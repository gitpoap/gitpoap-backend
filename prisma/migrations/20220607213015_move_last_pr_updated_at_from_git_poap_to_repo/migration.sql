/*
  Warnings:

  - You are about to drop the column `lastPRUpdatedAt` on the `GitPOAP` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GitPOAP" DROP COLUMN "lastPRUpdatedAt";

-- AlterTable
ALTER TABLE "Repo" ADD COLUMN     "lastPRUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT date_trunc('year', now());
