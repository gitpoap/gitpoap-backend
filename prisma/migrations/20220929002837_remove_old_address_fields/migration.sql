/*
  Warnings:

  - You are about to drop the column `oldMintedAddress` on the `Claim` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `Email` table. All the data in the column will be lost.
  - You are about to drop the column `oldAddress` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `oldEnsAvatarImageUrl` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `oldEnsName` on the `Profile` table. All the data in the column will be lost.
  - Added the required column `emailAddress` to the `Email` table without a default value. This is not possible if the table is not empty.
  - Made the column `addressId` on table `Profile` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Profile" DROP CONSTRAINT "Profile_addressId_fkey";

-- DropIndex
DROP INDEX "Email_address_key";

-- DropIndex
DROP INDEX "Profile_oldAddress_key";

-- AlterTable
ALTER TABLE "Claim" DROP COLUMN "oldMintedAddress";

-- AlterTable
ALTER TABLE "Email" DROP COLUMN "address",
ADD COLUMN     "emailAddress" VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "oldAddress",
DROP COLUMN "oldEnsAvatarImageUrl",
DROP COLUMN "oldEnsName",
ALTER COLUMN "addressId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;