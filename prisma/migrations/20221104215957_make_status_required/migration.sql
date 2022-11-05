/*
  Warnings:

  - Made the column `adminApprovalStatus` on table `GitPOAPRequest` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "GitPOAPRequest" ALTER COLUMN "adminApprovalStatus" SET NOT NULL,
ALTER COLUMN "adminApprovalStatus" SET DEFAULT 'PENDING';
