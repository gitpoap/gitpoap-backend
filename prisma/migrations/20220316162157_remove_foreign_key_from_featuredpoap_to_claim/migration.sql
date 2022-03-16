/*
  Warnings:

  - You are about to drop the column `dummyField` on the `FeaturedPOAP` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "FeaturedPOAP" DROP CONSTRAINT "FeaturedPOAP_poapTokenId_fkey";

-- AlterTable
ALTER TABLE "FeaturedPOAP" DROP COLUMN "dummyField";
