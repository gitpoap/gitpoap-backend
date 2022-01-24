/*
  Warnings:

  - You are about to alter the column `githubRepoId` on the `Repo` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `Int`.

*/
-- AlterTable
ALTER TABLE `Repo` MODIFY `githubRepoId` INTEGER NOT NULL;
