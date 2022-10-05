/*
  Warnings:

  - You are about to drop the column `githubOAuthToken` on the `AuthToken` table. All the data in the column will be lost.
  - Added the required column `addressId` to the `AuthToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `AuthToken` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "AuthToken" DROP CONSTRAINT "AuthToken_githubId_fkey";

-- AlterTable
ALTER TABLE "AuthToken" DROP COLUMN "githubOAuthToken",
ADD COLUMN     "addressId" INTEGER NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "githubId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "githubOAuthToken" TEXT;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_githubId_fkey" FOREIGN KEY ("githubId") REFERENCES "User"("githubId") ON DELETE SET NULL ON UPDATE CASCADE;
