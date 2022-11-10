/*
  Warnings:

  - You are about to drop the column `eventId` on the `GitPOAPRequest` table. All the data in the column will be lost.
  - You are about to drop the column `eventUrl` on the `GitPOAPRequest` table. All the data in the column will be lost.
  - You are about to drop the column `expiryDate` on the `GitPOAPRequest` table. All the data in the column will be lost.
  - You are about to drop the column `isEnabled` on the `GitPOAPRequest` table. All the data in the column will be lost.
  - You are about to drop the column `isPRBased` on the `GitPOAPRequest` table. All the data in the column will be lost.
  - You are about to drop the column `level` on the `GitPOAPRequest` table. All the data in the column will be lost.
  - You are about to drop the column `ongoing` on the `GitPOAPRequest` table. All the data in the column will be lost.
  - You are about to drop the column `threshold` on the `GitPOAPRequest` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `GitPOAPRequest` table. All the data in the column will be lost.
  - You are about to drop the column `year` on the `GitPOAPRequest` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "GitPOAPRequest" DROP CONSTRAINT "GitPOAPRequest_eventId_fkey";

-- AlterTable
ALTER TABLE "GitPOAPRequest" DROP COLUMN "eventId",
DROP COLUMN "eventUrl",
DROP COLUMN "expiryDate",
DROP COLUMN "isEnabled",
DROP COLUMN "isPRBased",
DROP COLUMN "level",
DROP COLUMN "ongoing",
DROP COLUMN "threshold",
DROP COLUMN "type",
DROP COLUMN "year";
