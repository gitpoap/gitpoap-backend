/*
  Warnings:

  - You are about to alter the column `poapSecret` on the `GitPOAP` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(6)`.

*/
-- AlterTable
ALTER TABLE "GitPOAP" ALTER COLUMN "poapSecret" SET DATA TYPE VARCHAR(6);
