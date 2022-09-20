/*
  Warnings:

  - You are about to drop the column `email` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Claim` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Address" DROP COLUMN "email",
ADD COLUMN     "emailId" INTEGER;

-- AlterTable
ALTER TABLE "Claim" DROP COLUMN "email",
ADD COLUMN     "emailId" INTEGER;

-- CreateTable
CREATE TABLE "Email" (
    "id" SERIAL NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Email_address_key" ON "Email"("address");

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE SET NULL ON UPDATE CASCADE;
