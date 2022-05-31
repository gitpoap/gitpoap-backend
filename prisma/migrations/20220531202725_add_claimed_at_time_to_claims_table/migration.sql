-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "claimedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GitPOAP" ALTER COLUMN "lastPRUpdatedAt" SET DEFAULT date_trunc('year', now());
