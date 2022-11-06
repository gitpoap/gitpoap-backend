/*
  Warnings:

  - You are about to drop the column `imageKey` on the `GitPOAPRequest` table. All the data in the column will be lost.
  - Added the required column `imageUrl` to the `GitPOAPRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GitPOAPRequest" DROP COLUMN "imageKey",
ADD COLUMN     "imageUrl" TEXT NOT NULL;
