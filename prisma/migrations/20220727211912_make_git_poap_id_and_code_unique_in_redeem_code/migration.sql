/*
  Warnings:

  - A unique constraint covering the columns `[gitPOAPId,code]` on the table `RedeemCode` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "RedeemCode_gitPOAPId_code_key" ON "RedeemCode"("gitPOAPId", "code");
