/*
  Warnings:

  - A unique constraint covering the columns `[privyUserId]` on the table `GithubUser` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "GithubUser" ADD COLUMN     "privyUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GithubUser_privyUserId_key" ON "GithubUser"("privyUserId");
