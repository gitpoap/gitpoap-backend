/*
  Warnings:

  - A unique constraint covering the columns `[githubOrgId]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `githubOrgId` to the `Organization` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "githubOrgId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_githubOrgId_key" ON "Organization"("githubOrgId");
