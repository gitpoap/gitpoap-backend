/*
  Warnings:

  - Made the column `canRequestMoreCodes` on table `GitPOAP` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "GitPOAP" ALTER COLUMN "canRequestMoreCodes" SET NOT NULL,
ALTER COLUMN "canRequestMoreCodes" SET DEFAULT false;
