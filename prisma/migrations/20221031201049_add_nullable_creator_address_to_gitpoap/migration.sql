-- AlterTable
ALTER TABLE "GitPOAP" ADD COLUMN     "creatorAddressId" INTEGER;

-- AddForeignKey
ALTER TABLE "GitPOAP" ADD CONSTRAINT "GitPOAP_creatorAddressId_fkey" FOREIGN KEY ("creatorAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
