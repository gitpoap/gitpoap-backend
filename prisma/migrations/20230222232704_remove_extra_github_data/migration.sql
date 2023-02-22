/*
  Warnings:

  - You are about to drop the column `githubOAuthToken` on the `GithubUser` table. All the data in the column will be lost.
  - You are about to drop the column `privyUserId` on the `GithubUser` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "GithubUser_privyUserId_key";

-- AlterTable
ALTER TABLE "GithubUser" DROP COLUMN "githubOAuthToken",
DROP COLUMN "privyUserId";
