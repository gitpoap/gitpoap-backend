/*
  Warnings:

  - You are about to drop the column `POAPSecret` on the `Claim` table. All the data in the column will be lost.
  - Added the required column `poapSecret` to the `Claim` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Claim" DROP COLUMN "POAPSecret",
ADD COLUMN     "poapSecret" TEXT NOT NULL;
