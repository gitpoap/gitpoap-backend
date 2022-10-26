/*
  Warnings:

  - Added the required column `addressId` to the `GitPOAPRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GitPOAPRequest" ADD COLUMN     "addressId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "GitPOAPRequest" ADD CONSTRAINT "GitPOAPRequest_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
