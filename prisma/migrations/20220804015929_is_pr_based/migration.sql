/*
  Warnings:

  - Made the column `description` on table `GitPOAP` required. This step will fail if there are existing NULL values in that column.
  - Made the column `imageUrl` on table `GitPOAP` required. This step will fail if there are existing NULL values in that column.
  - Made the column `name` on table `GitPOAP` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "GitPOAP" ADD COLUMN     "isPRBased" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "imageUrl" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL;
