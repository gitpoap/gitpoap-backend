/*
  Warnings:

  - You are about to drop the column `discordUserId` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `addressId` on the `Email` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Address" DROP CONSTRAINT "Address_discordUserId_fkey";

-- DropForeignKey
ALTER TABLE "Email" DROP CONSTRAINT "Email_addressId_fkey";

-- DropIndex
DROP INDEX "Email_addressId_key";

-- AlterTable
ALTER TABLE "Address" DROP COLUMN "discordUserId";

-- AlterTable
ALTER TABLE "Email" DROP COLUMN "addressId";
