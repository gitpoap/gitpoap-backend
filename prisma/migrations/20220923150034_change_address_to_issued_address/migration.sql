/*
  Warnings:

  - You are about to drop the column `addressId` on the `Claim` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[gitPOAPId,issuedAddressId]` on the table `Claim` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Claim" DROP CONSTRAINT "Claim_addressId_fkey";

-- DropIndex
DROP INDEX "Claim_gitPOAPId_addressId_key";

-- AlterTable
ALTER TABLE "Claim" DROP COLUMN "addressId",
ADD COLUMN     "issuedAddressId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Claim_gitPOAPId_issuedAddressId_key" ON "Claim"("gitPOAPId", "issuedAddressId");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_issuedAddressId_fkey" FOREIGN KEY ("issuedAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
