/*
  Warnings:

  - You are about to drop the column `status` on the `GitPOAP` table. All the data in the column will be lost.
  - The `type` column on the `GitPOAP` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[emailAddress]` on the table `Email` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "GitPOAPType" AS ENUM ('ANNUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AdminApprovalStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

-- DropForeignKey
ALTER TABLE "Claim" DROP CONSTRAINT "Claim_userId_fkey";

-- DropForeignKey
ALTER TABLE "Email" DROP CONSTRAINT "Email_addressId_fkey";

-- DropForeignKey
ALTER TABLE "GitPOAP" DROP CONSTRAINT "GitPOAP_projectId_fkey";

-- AlterTable
ALTER TABLE "Claim" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Email" ALTER COLUMN "activeToken" DROP NOT NULL,
ALTER COLUMN "addressId" DROP NOT NULL,
ALTER COLUMN "tokenExpiresAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "GitPOAP"
RENAME COLUMN "status" to "poapApprovalStatus";

-- AlterTable
ALTER TABLE "GitPOAP"
ADD COLUMN     "organizationId" INTEGER,
DROP COLUMN "type",
ADD COLUMN     "type" "GitPOAPType" NOT NULL DEFAULT 'ANNUAL',
ALTER COLUMN "projectId" DROP NOT NULL;

-- DropEnum
DROP TYPE "ClaimType";

-- CreateTable
CREATE TABLE "GitPOAPRequest" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "type" "GitPOAPType" NOT NULL DEFAULT 'ANNUAL',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "eventUrl" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "numRequestedCodes" INTEGER NOT NULL,
    "imageKey" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "projectId" INTEGER,
    "organizationId" INTEGER,
    "ongoing" BOOLEAN NOT NULL DEFAULT false,
    "eventId" INTEGER,
    "level" INTEGER NOT NULL DEFAULT 1,
    "threshold" INTEGER NOT NULL DEFAULT 1,
    "isPRBased" BOOLEAN NOT NULL DEFAULT true,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "contributors" JSON NOT NULL,
    "adminApprovalStatus" "AdminApprovalStatus",
    "gitPOAPId" INTEGER,

    CONSTRAINT "GitPOAPRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GitPOAPRequest_gitPOAPId_key" ON "GitPOAPRequest"("gitPOAPId");

-- CreateIndex
CREATE UNIQUE INDEX "Email_emailAddress_key" ON "Email"("emailAddress");

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitPOAP" ADD CONSTRAINT "GitPOAP_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitPOAP" ADD CONSTRAINT "GitPOAP_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitPOAPRequest" ADD CONSTRAINT "GitPOAPRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitPOAPRequest" ADD CONSTRAINT "GitPOAPRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitPOAPRequest" ADD CONSTRAINT "GitPOAPRequest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitPOAPRequest" ADD CONSTRAINT "GitPOAPRequest_gitPOAPId_fkey" FOREIGN KEY ("gitPOAPId") REFERENCES "GitPOAP"("id") ON DELETE SET NULL ON UPDATE CASCADE;
