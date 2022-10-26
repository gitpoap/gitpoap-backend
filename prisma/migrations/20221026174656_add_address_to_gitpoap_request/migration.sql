/*
  Warnings:

  - A unique constraint covering the columns `[addressId]` on the table `GitPOAPRequest` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `addressId` to the `GitPOAPRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GitPOAPRequest" ADD COLUMN     "addressId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "GitPOAPRequest_addressId_key" ON "GitPOAPRequest"("addressId");

-- AddForeignKey
ALTER TABLE "GitPOAPRequest" ADD CONSTRAINT "GitPOAPRequest_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
