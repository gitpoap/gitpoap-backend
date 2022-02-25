/*
  Warnings:

  - Made the column `organizationId` on table `Repo` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Repo" DROP CONSTRAINT "Repo_organizationId_fkey";

-- AlterTable
ALTER TABLE "Repo" ALTER COLUMN "organizationId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Repo" ADD CONSTRAINT "Repo_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
