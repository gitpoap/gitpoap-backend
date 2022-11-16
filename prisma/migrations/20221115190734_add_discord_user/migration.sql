-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "discordUserId" INTEGER;

-- AlterTable
ALTER TABLE "AuthToken" ADD COLUMN     "discordUserId" INTEGER;

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "discordUserId" INTEGER;

-- CreateTable
CREATE TABLE "DiscordUser" (
    "id" SERIAL NOT NULL,
    "discordHandle" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "discordOAuthToken" TEXT,

    CONSTRAINT "DiscordUser_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "DiscordUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "DiscordUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_discordUserId_fkey" FOREIGN KEY ("discordUserId") REFERENCES "DiscordUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "DiscordUser" ADD COLUMN     "discordId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DiscordUser_discordId_key" ON "DiscordUser"("discordId");
