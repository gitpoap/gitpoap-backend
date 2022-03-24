/*
  Warnings:

  - You are about to drop the column `approved` on the `GitPOAP` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "GitPOAPStatus" AS ENUM ('UNAPPROVED', 'APPROVED', 'REDEEM_REQUEST_PENDING');

-- AlterTable
ALTER TABLE "GitPOAP" DROP COLUMN "approved",
ADD COLUMN     "status" "GitPOAPStatus" NOT NULL DEFAULT E'UNAPPROVED';
