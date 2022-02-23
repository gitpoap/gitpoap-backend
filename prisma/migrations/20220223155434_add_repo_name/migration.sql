/*
  Warnings:

  - Added the required column `name` to the `Repo` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Repo" ADD COLUMN     "name" VARCHAR(50) NOT NULL;
