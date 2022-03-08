/*
  Warnings:

  - Added the required column `poapQRHash` to the `GitPOAP` table without a default value. This is not possible if the table is not empty.
  - Added the required column `poapSecret` to the `GitPOAP` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GitPOAP" ADD COLUMN     "poapQRHash" TEXT NOT NULL,
ADD COLUMN     "poapSecret" TEXT NOT NULL;
