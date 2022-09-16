
-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('ADMIN', 'OWNER', 'MEMBER');

-- DropIndex
DROP INDEX "Profile_address_key";

-- AlterTable
ALTER TABLE "Claim"
RENAME COLUMN "address" to "oldMintedAddress";

-- AlterTable
ALTER TABLE "Claim"
ADD COLUMN "email" VARCHAR(255);

-- AlterTable
ALTER TABLE "Profile"
RENAME COLUMN "address" to "oldAddress";

-- CreateTable
CREATE TABLE "Address" (
    "id" SERIAL NOT NULL,
    "ethAddress" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "githubUserId" INTEGER NOT NULL,
    "ensAvatarImageUrl" VARCHAR(255),
    "ensName" VARCHAR(255),

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "addressId" INTEGER NOT NULL,
    "role" "MembershipRole" NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Address_ethAddress_key" ON "Address"("ethAddress");

-- CreateIndex
CREATE INDEX "Address_ethAddress_idx" ON "Address"("ethAddress");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_addressId_key" ON "OrganizationMembership"("organizationId", "addressId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_oldAddress_key" ON "Profile"("oldAddress");

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_githubUserId_fkey" FOREIGN KEY ("githubUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
