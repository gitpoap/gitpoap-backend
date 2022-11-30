/*
  Warnings:

*/
-- AlterEnum
ALTER TYPE "AdminApprovalStatus" RENAME TO "StaffApprovalStatus";

-- AlterTable
ALTER TABLE "GitPOAPRequest" RENAME COLUMN "adminApprovalStatus" TO "staffApprovalStatus";
