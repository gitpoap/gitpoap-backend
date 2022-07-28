/*
  Warnings:

  - A unique constraint covering the columns `[gitPOAPId,code]` on the table `RedeemCode` will be added. If there are existing duplicate values, this will fail.

*/

-- Remove duplicated rows in RedeemCode (chooses the lowest ids to keep)
DELETE FROM "RedeemCode" as a USING "RedeemCode" as b WHERE a.id > b.id AND a."gitPOAPId" = b."gitPOAPId" AND a.code = b.code;

-- CreateIndex
CREATE UNIQUE INDEX "RedeemCode_gitPOAPId_code_key" ON "RedeemCode"("gitPOAPId", "code");
