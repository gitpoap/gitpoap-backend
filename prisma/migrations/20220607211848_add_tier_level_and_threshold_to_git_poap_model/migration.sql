-- AlterTable
ALTER TABLE "GitPOAP" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "threshold" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "lastPRUpdatedAt" SET DEFAULT date_trunc('year', now());
