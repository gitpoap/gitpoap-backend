/*
  Warnings:

  - You are about to drop the column `githubId` on the `AuthToken` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "AuthToken" DROP CONSTRAINT "AuthToken_githubId_fkey";

-- AlterTable
ALTER TABLE "AuthToken" DROP COLUMN "githubId";
