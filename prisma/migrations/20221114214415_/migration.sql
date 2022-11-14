/*
  Warnings:

  - A unique constraint covering the columns `[gitPOAPRequestId]` on the table `GitPOAP` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[gitPOAPId]` on the table `GitPOAPRequest` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "GitPOAPRequest" ADD COLUMN     "gitPOAPId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "GitPOAP_gitPOAPRequestId_key" ON "GitPOAP"("gitPOAPRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "GitPOAPRequest_gitPOAPId_key" ON "GitPOAPRequest"("gitPOAPId");
