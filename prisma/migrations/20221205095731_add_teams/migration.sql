/*
  Warnings:

  - You are about to drop the column `organizationId` on the `GitPOAP` table. All the data in the column will be lost.
  - You are about to drop the column `organizationId` on the `GitPOAPRequest` table. All the data in the column will be lost.
  - You are about to drop the `Organization` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OrganizationMembership` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "MembershipAcceptanceStatus" AS ENUM ('ACCEPTED', 'PENDING');

-- DropForeignKey
ALTER TABLE "GitPOAP" DROP CONSTRAINT "GitPOAP_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "GitPOAPRequest" DROP CONSTRAINT "GitPOAPRequest_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "OrganizationMembership" DROP CONSTRAINT "OrganizationMembership_addressId_fkey";

-- DropForeignKey
ALTER TABLE "OrganizationMembership" DROP CONSTRAINT "OrganizationMembership_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "Repo" DROP CONSTRAINT "Repo_organizationId_fkey";

-- AlterTable
ALTER TABLE "GitPOAP" DROP COLUMN "organizationId",
ADD COLUMN     "teamId" INTEGER;

-- AlterTable
ALTER TABLE "GitPOAPRequest" DROP COLUMN "organizationId",
ADD COLUMN     "teamId" INTEGER;

-- AlterTable
ALTER TABLE "Organization" RENAME TO "GithubOrganization";
ALTER TABLE "GithubOrganization" RENAME CONSTRAINT "Organization_pkey" TO "GithubOrganization_pkey";

-- DropTable
DROP TABLE "OrganizationMembership";

-- CreateTable
CREATE TABLE "Membership" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "teamId" INTEGER NOT NULL,
    "addressId" INTEGER NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "acceptanceStatus" "MembershipAcceptanceStatus" NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "ownerAddressId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "logoImageUrl" TEXT NOT NULL,
    "approvalStatus" "StaffApprovalStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Membership_teamId_addressId_key" ON "Membership"("teamId", "addressId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubOrganization_githubOrgId_key" ON "GithubOrganization"("githubOrgId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerAddressId_fkey" FOREIGN KEY ("ownerAddressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repo" ADD CONSTRAINT "Repo_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "GithubOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitPOAP" ADD CONSTRAINT "GitPOAP_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitPOAPRequest" ADD CONSTRAINT "GitPOAPRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
