/*
  Warnings:

  - You are about to drop the column `description` on the `GithubOrganization` table. All the data in the column will be lost.
  - You are about to drop the column `twitterHandle` on the `GithubOrganization` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `GithubOrganization` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GithubOrganization" DROP COLUMN "description",
DROP COLUMN "twitterHandle",
DROP COLUMN "url";
