/*
  Warnings:

  - Added the required column `POAPSecret` to the `Claim` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "POAPSecret" TEXT NOT NULL;
