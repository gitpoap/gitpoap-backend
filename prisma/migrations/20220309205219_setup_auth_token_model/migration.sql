/*
  Warnings:

  - You are about to drop the column `oauthToken` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "oauthToken",
ADD COLUMN     "nextGeneration" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" SERIAL NOT NULL,
    "generation" INTEGER NOT NULL,
    "oauthToken" TEXT NOT NULL,
    "refreshSecret" VARCHAR(50) NOT NULL,
    "githubId" INTEGER NOT NULL,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_refreshSecret_key" ON "AuthToken"("refreshSecret");

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_githubId_fkey" FOREIGN KEY ("githubId") REFERENCES "User"("githubId") ON DELETE RESTRICT ON UPDATE CASCADE;
