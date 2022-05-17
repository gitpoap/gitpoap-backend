-- AlterTable
ALTER TABLE "GitPOAP" ADD COLUMN     "eventId" INTEGER,
ALTER COLUMN "lastPRUpdatedAt" SET DEFAULT date_trunc('year', now());

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "organization" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "location" VARCHAR(255) NOT NULL,
    "imageUrl" VARCHAR(255),
    "githubHandle" VARCHAR(255),
    "twitterHandle" VARCHAR(255),
    "siteUrl" VARCHAR(255),

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GitPOAP" ADD CONSTRAINT "GitPOAP_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
