"use server";

import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { CreateReportState } from "@/app/type/CreateReportState";
import { createReportSchema } from "@/app/validation/zod";

import { put, del } from "@vercel/blob";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

export async function createReportAction(
  _prevState: CreateReportState,
  formData: FormData,
): Promise<CreateReportState> {
  let uploadedBlobUrl: string | null = null;

  try {
    // 1. Check authentication
    const session = await auth();

    if (!session?.user?.id) {
      return {
        success: false,
        message: "You must be logged in to submit a report.",
      };
    }

    if (session.user.role !== "USER") {
      return {
        success: false,
        message: "Only users can submit waste reports.",
      };
    }

    // 2. Collect form data
    const rawData = {
      title: formData.get("title"),
      description: formData.get("description"),
      category: formData.get("category"),
      address: formData.get("address"),
      latitude: formData.get("latitude"),
      longitude: formData.get("longitude"),
      image: formData.get("image"),
    };

    // 3. Validate form data
    const validation = createReportSchema.safeParse({
      title: rawData.title?.toString() ?? "",
      description: rawData.description?.toString() ?? "",
      category: rawData.category?.toString() ?? "",
      address: rawData.address?.toString() ?? "",
      latitude: rawData.latitude?.toString() ?? "",
      longitude: rawData.longitude?.toString() ?? "",
      image: rawData.image,
    });

    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;

      return {
        success: false,
        message: "Please check the form fields.",
        errors: {
          title: errors.title?.[0],
          description: errors.description?.[0],
          category: errors.category?.[0],
          address: errors.address?.[0],
          latitude: errors.latitude?.[0],
          longitude: errors.longitude?.[0],
          image: errors.image?.[0],
        },
      };
    }

    const {
      title,
      description,
      category,
      address,
      latitude,
      longitude,
      image,
    } = validation.data;

    // 4. Check category existence
    const existingCategory = await prisma.wasteCategory.findUnique({
      where: { id: category },
      select: { id: true },
    });

    if (!existingCategory) {
      return {
        success: false,
        message: "Selected waste category does not exist.",
        errors: {
          category: "Please select a valid category.",
        },
      };
    }

    // 5. Validate image
    const allowedExtensions: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
    };

    const extension = allowedExtensions[image.type];

    if (!extension || image.size > 4 * 1024 * 1024) {
      return {
        success: false,
        message: "Invalid image file.",
        errors: {
          image: !extension
            ? "Only JPEG, PNG, and WebP images are allowed."
            : "Maximum image size is 4 MB.",
        },
      };
    }

    // 6. Upload image to Vercel Blob
    const fileName = `${randomUUID()}${extension}`;

    const blob = await put(`reports/${fileName}`, image, {
      access: "public",
      contentType: image.type,
      addRandomSuffix: false,
    });

    uploadedBlobUrl = blob.url;

    // 7. Save report, image, and status history
    await prisma.$transaction(async (tx) => {
      const report = await tx.wasteReport.create({
        data: {
          title,
          description,
          address,
          latitude,
          longitude,
          status: "PENDING",
          userId: session.user.id,
          confirmedCategoryId: category,
        },
      });

      await tx.reportImage.create({
        data: {
          reportId: report.id,
          imageUrl: blob.url,
        },
      });

      await tx.reportStatusHistory.create({
        data: {
          reportId: report.id,
          changedBy: session.user.id,
          oldStatus: null,
          newStatus: "PENDING",
          note: "Report submitted.",
        },
      });
    });

    // 8. Revalidate relevant pages
    revalidatePath("/dashboard");
    revalidatePath("/reports");

    return {
      success: true,
      message: "Waste report submitted successfully!",
    };
  } catch (error) {
    // 9. Cleanup uploaded Blob if database operation fails
    if (uploadedBlobUrl) {
      try {
        await del(uploadedBlobUrl);
      } catch (deleteError) {
        console.error("Failed to delete uploaded Blob:", deleteError);
      }
    }

    console.error("Create report error:", error);

    return {
      success: false,
      message: "Failed to submit report. Please try again.",
    };
  }
}
