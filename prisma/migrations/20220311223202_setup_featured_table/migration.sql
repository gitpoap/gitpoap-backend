-- CreateTable
CREATE TABLE "FeaturedPOAP" (
    "id" SERIAL NOT NULL,
    "poapTokenId" INTEGER NOT NULL,
    "profileId" INTEGER NOT NULL,

    CONSTRAINT "FeaturedPOAP_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FeaturedPOAP" ADD CONSTRAINT "FeaturedPOAP_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
