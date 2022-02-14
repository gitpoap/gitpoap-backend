-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('UNCLAIMED', 'PENDING', 'CLAIMED');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('ANNUAL', 'QUARTERLY', 'MANUAL');

-- CreateTable
CREATE TABLE "Profile" (
    "id" SERIAL NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bio" TEXT NOT NULL,
    "bannerImageUrl" VARCHAR(255),
    "name" VARCHAR(255),
    "profileImageUrl" VARCHAR(255),

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repo" (
    "id" SERIAL NOT NULL,
    "githubRepoId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" INTEGER,

    CONSTRAINT "Repo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT E'UNCLAIMED',
    "poapTokenId" VARCHAR(255),
    "address" VARCHAR(255),
    "gitPOAPId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitPOAP" (
    "id" SERIAL NOT NULL,
    "type" "ClaimType" NOT NULL DEFAULT E'ANNUAL',
    "year" INTEGER NOT NULL,
    "poapEventId" INTEGER NOT NULL,
    "repoId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitPOAP_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_address_key" ON "Profile"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Repo_githubRepoId_key" ON "Repo"("githubRepoId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_poapTokenId_key" ON "Claim"("poapTokenId");

-- CreateIndex
CREATE UNIQUE INDEX "GitPOAP_poapEventId_key" ON "GitPOAP"("poapEventId");

-- AddForeignKey
ALTER TABLE "Repo" ADD CONSTRAINT "Repo_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_gitPOAPId_fkey" FOREIGN KEY ("gitPOAPId") REFERENCES "GitPOAP"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitPOAP" ADD CONSTRAINT "GitPOAP_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
