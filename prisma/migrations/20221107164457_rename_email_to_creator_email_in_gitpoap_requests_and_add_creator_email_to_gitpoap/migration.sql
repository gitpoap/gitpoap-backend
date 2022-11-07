/*
  Warnings:

  - You are about to drop the column `email` on the `GitPOAPRequest` table. All the data in the column will be lost.
  - Added the required column `creatorEmail` to the `GitPOAPRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GitPOAP" ADD COLUMN     "creatorEmail" VARCHAR(255);

-- AlterTable
ALTER TABLE "GitPOAPRequest" DROP COLUMN "email",
ADD COLUMN     "creatorEmail" VARCHAR(255) NOT NULL;
