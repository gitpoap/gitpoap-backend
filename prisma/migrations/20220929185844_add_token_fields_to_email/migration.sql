/*
  Warnings:

  - You are about to drop the column `emailId` on the `Address` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[addressId]` on the table `Email` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[activeToken]` on the table `Email` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `activeToken` to the `Email` table without a default value. This is not possible if the table is not empty.
  - Added the required column `addressId` to the `Email` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tokenExpiresAt` to the `Email` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Address" DROP CONSTRAINT "Address_emailId_fkey";

-- AlterTable
ALTER TABLE "Address" DROP COLUMN "emailId";

-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "activeToken" TEXT NOT NULL,
ADD COLUMN     "addressId" INTEGER NOT NULL,
ADD COLUMN     "isValidated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Email_addressId_key" ON "Email"("addressId");

-- CreateIndex
CREATE UNIQUE INDEX "Email_activeToken_key" ON "Email"("activeToken");

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
