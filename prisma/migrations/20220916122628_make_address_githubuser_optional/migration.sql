-- DropForeignKey
ALTER TABLE "Address" DROP CONSTRAINT "Address_githubUserId_fkey";

-- AlterTable
ALTER TABLE "Address" ALTER COLUMN "githubUserId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_githubUserId_fkey" FOREIGN KEY ("githubUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
