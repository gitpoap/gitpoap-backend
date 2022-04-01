-- AlterEnum
ALTER TYPE "ClaimStatus" ADD VALUE 'MINTING';

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "qrHash" VARCHAR(10);
