/*
  Warnings:

  - You are about to drop the column `activeToken` on the `Email` table. All the data in the column will be lost.
  - You are about to drop the column `isValidated` on the `Email` table. All the data in the column will be lost.
  - You are about to drop the column `tokenExpiresAt` on the `Email` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Email_activeToken_key";

-- AlterTable
ALTER TABLE "Email" DROP COLUMN "activeToken",
DROP COLUMN "isValidated",
DROP COLUMN "tokenExpiresAt";
