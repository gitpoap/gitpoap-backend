-- CreateTable
CREATE TABLE "APIKey" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "APIKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "APIKey_key_key" ON "APIKey"("key");
