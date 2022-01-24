/*
  Warnings:

  - The primary key for the `Claim` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `poapEventId` on the `Claim` table. All the data in the column will be lost.
  - You are about to drop the column `repoId` on the `Claim` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `Claim` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to alter the column `userId` on the `Claim` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - The primary key for the `Profile` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `Profile` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - The primary key for the `Repo` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `Repo` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `User` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - Added the required column `gitPOAPId` to the `Claim` table without a default value. This is not possible if the table is not empty.
  - Added the required column `githubHandle` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Claim` DROP FOREIGN KEY `Claim_repoId_fkey`;

-- DropForeignKey
ALTER TABLE `Claim` DROP FOREIGN KEY `Claim_userId_fkey`;

-- AlterTable
ALTER TABLE `Claim` DROP PRIMARY KEY,
    DROP COLUMN `poapEventId`,
    DROP COLUMN `repoId`,
    ADD COLUMN `address` VARCHAR(255) NULL,
    ADD COLUMN `gitPOAPId` INTEGER NOT NULL,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `userId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `Profile` DROP PRIMARY KEY,
    ADD COLUMN `bannerImageUrl` VARCHAR(255) NULL,
    ADD COLUMN `name` VARCHAR(255) NULL,
    ADD COLUMN `profileImageUrl` VARCHAR(255) NULL,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `Repo` DROP PRIMARY KEY,
    ADD COLUMN `organizationId` INTEGER NULL,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `User` DROP PRIMARY KEY,
    ADD COLUMN `githubHandle` VARCHAR(255) NOT NULL,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- CreateTable
CREATE TABLE `Organization` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GitPOAP` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('ANNUAL', 'QUARTERLY', 'MANUAL') NOT NULL DEFAULT 'ANNUAL',
    `year` INTEGER NOT NULL,
    `poapEventId` INTEGER NOT NULL,
    `repoId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GitPOAP_poapEventId_key`(`poapEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Repo` ADD CONSTRAINT `Repo_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Claim` ADD CONSTRAINT `Claim_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Claim` ADD CONSTRAINT `Claim_gitPOAPId_fkey` FOREIGN KEY (`gitPOAPId`) REFERENCES `GitPOAP`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GitPOAP` ADD CONSTRAINT `GitPOAP_repoId_fkey` FOREIGN KEY (`repoId`) REFERENCES `Repo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
