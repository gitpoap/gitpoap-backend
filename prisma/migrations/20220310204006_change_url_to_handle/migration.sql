/*
  Warnings:

  - You are about to drop the column `twitterUrl` on the `Profile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "twitterUrl",
ADD COLUMN     "twitterHandle" VARCHAR(255);
