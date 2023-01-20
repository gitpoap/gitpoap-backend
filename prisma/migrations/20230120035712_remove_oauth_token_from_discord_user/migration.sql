/*
  Warnings:

  - You are about to drop the column `discordOAuthToken` on the `DiscordUser` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DiscordUser" DROP COLUMN "discordOAuthToken";
