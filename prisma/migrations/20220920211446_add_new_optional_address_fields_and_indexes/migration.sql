/*
  Warnings:

  - A unique constraint covering the columns `[gitPOAPId,mintedAddressId]` on the table `Claim` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[gitPOAPId,addressId]` on the table `Claim` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[gitPOAPId,emailId]` on the table `Claim` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[addressId]` on the table `Profile` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "addressId" INTEGER,
ADD COLUMN     "mintedAddressId" INTEGER;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "addressId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Claim_gitPOAPId_mintedAddressId_key" ON "Claim"("gitPOAPId", "mintedAddressId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_gitPOAPId_addressId_key" ON "Claim"("gitPOAPId", "addressId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_gitPOAPId_emailId_key" ON "Claim"("gitPOAPId", "emailId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_addressId_key" ON "Profile"("addressId");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_mintedAddressId_fkey" FOREIGN KEY ("mintedAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
