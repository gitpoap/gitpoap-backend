-- CreateTable
CREATE TABLE "RedeemCode" (
    "id" SERIAL NOT NULL,
    "gitPOAPId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "RedeemCode_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RedeemCode" ADD CONSTRAINT "RedeemCode_gitPOAPId_fkey" FOREIGN KEY ("gitPOAPId") REFERENCES "GitPOAP"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
