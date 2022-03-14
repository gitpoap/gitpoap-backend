-- CreateTable
CREATE TABLE "FeaturedPOAP" (
    "id" SERIAL NOT NULL,
    "poapTokenId" VARCHAR(255) NOT NULL,
    "profileId" INTEGER NOT NULL,

    CONSTRAINT "FeaturedPOAP_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedPOAP_poapTokenId_profileId_key" ON "FeaturedPOAP"("poapTokenId", "profileId");

-- AddForeignKey
ALTER TABLE "FeaturedPOAP" ADD CONSTRAINT "FeaturedPOAP_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
