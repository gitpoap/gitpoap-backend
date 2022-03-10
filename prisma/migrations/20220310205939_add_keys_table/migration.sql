-- CreateTable
CREATE TABLE "Key" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Key_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Key_name_key" ON "Key"("name");
