/*
  Warnings:

  - You are about to drop the column `ensAvatarImageUrl` on the `Profile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Profile" RENAME "ensAvatarImageUrl" TO "oldEnsAvatarImageUrl";
