/*
  Warnings:

  - You are about to drop the column `creatorEmail` on the `GitPOAP` table. All the data in the column will be lost.
  - You are about to drop the column `creatorEmail` on the `GitPOAPRequest` table. All the data in the column will be lost.
  - Added the required column `creatorEmailId` to the `GitPOAPRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GitPOAP" DROP COLUMN "creatorEmail",
ADD COLUMN     "creatorEmailId" INTEGER;

-- AlterTable
ALTER TABLE "GitPOAPRequest" DROP COLUMN "creatorEmail",
ADD COLUMN     "creatorEmailId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "GitPOAP" ADD CONSTRAINT "GitPOAP_creatorEmailId_fkey" FOREIGN KEY ("creatorEmailId") REFERENCES "Email"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitPOAPRequest" ADD CONSTRAINT "GitPOAPRequest_creatorEmailId_fkey" FOREIGN KEY ("creatorEmailId") REFERENCES "Email"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
