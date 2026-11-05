/*
  Warnings:

  - Added the required column `title` to the `waste_reports` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "waste_reports" ADD COLUMN     "title" VARCHAR(100) NOT NULL;
