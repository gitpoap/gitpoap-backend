/*
  Warnings:

  - You are about to drop the column `repoId` on the `GitPOAP` table. All the data in the column will be lost.
  - Made the column `projectId` on table `GitPOAP` required. This step will fail if there are existing NULL values in that column.
  - Made the column `projectId` on table `Repo` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "GitPOAP" DROP CONSTRAINT "GitPOAP_projectId_fkey";

-- DropForeignKey
ALTER TABLE "GitPOAP" DROP CONSTRAINT "GitPOAP_repoId_fkey";

-- DropForeignKey
ALTER TABLE "Repo" DROP CONSTRAINT "Repo_projectId_fkey";

-- AlterTable
ALTER TABLE "GitPOAP" DROP COLUMN "repoId",
ALTER COLUMN "projectId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Repo" ALTER COLUMN "projectId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Repo" ADD CONSTRAINT "Repo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitPOAP" ADD CONSTRAINT "GitPOAP_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
