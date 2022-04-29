-- AlterTable
ALTER TABLE "GitPOAP" ALTER COLUMN "lastPRUpdatedAt" SET DEFAULT date_trunc('year', now());

-- CreateTable
CREATE TABLE "BatchTiming" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "lastRun" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchTiming_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BatchTiming_name_key" ON "BatchTiming"("name");
