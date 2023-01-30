/*
  Warnings:

  - You are about to drop the column `githubUserId` on the `Address` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Address" DROP CONSTRAINT "Address_githubUserId_fkey";

-- AlterTable
ALTER TABLE "Address" DROP COLUMN "githubUserId";
