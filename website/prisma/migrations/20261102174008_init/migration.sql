-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PredictionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waste_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waste_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waste_reports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "confirmed_category_id" UUID,
    "description" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "address" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waste_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_predictions" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "predicted_category_id" UUID NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "model_version" VARCHAR(50) NOT NULL,
    "prediction_status" "PredictionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_images" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_status_histories" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "changed_by" UUID NOT NULL,
    "old_status" "ReportStatus",
    "new_status" "ReportStatus" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_status_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "waste_categories_name_key" ON "waste_categories"("name");

-- CreateIndex
CREATE INDEX "waste_reports_user_id_idx" ON "waste_reports"("user_id");

-- CreateIndex
CREATE INDEX "waste_reports_confirmed_category_id_idx" ON "waste_reports"("confirmed_category_id");

-- CreateIndex
CREATE INDEX "waste_reports_status_idx" ON "waste_reports"("status");

-- CreateIndex
CREATE INDEX "waste_reports_created_at_idx" ON "waste_reports"("created_at");

-- CreateIndex
CREATE INDEX "ai_predictions_report_id_idx" ON "ai_predictions"("report_id");

-- CreateIndex
CREATE INDEX "ai_predictions_predicted_category_id_idx" ON "ai_predictions"("predicted_category_id");

-- CreateIndex
CREATE INDEX "report_images_report_id_idx" ON "report_images"("report_id");

-- CreateIndex
CREATE INDEX "report_status_histories_report_id_idx" ON "report_status_histories"("report_id");

-- CreateIndex
CREATE INDEX "report_status_histories_changed_by_idx" ON "report_status_histories"("changed_by");

-- CreateIndex
CREATE INDEX "report_status_histories_created_at_idx" ON "report_status_histories"("created_at");

-- AddForeignKey
ALTER TABLE "waste_reports" ADD CONSTRAINT "waste_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waste_reports" ADD CONSTRAINT "waste_reports_confirmed_category_id_fkey" FOREIGN KEY ("confirmed_category_id") REFERENCES "waste_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_predictions" ADD CONSTRAINT "ai_predictions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "waste_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_predictions" ADD CONSTRAINT "ai_predictions_predicted_category_id_fkey" FOREIGN KEY ("predicted_category_id") REFERENCES "waste_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_images" ADD CONSTRAINT "report_images_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "waste_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_status_histories" ADD CONSTRAINT "report_status_histories_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "waste_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_status_histories" ADD CONSTRAINT "report_status_histories_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
