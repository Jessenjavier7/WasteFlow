/*
  Warnings:

  - You are about to drop the `ai_predictions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sessions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ai_predictions" DROP CONSTRAINT "ai_predictions_predicted_category_id_fkey";

-- DropForeignKey
ALTER TABLE "ai_predictions" DROP CONSTRAINT "ai_predictions_report_id_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_fkey";

-- DropTable
DROP TABLE "ai_predictions";

-- DropTable
DROP TABLE "sessions";
