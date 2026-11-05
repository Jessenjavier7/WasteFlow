"use server";

import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { CreateReportState } from "@/app/type/CreateReportState";
import { createReportSchema } from "@/app/validation/zod";

import { put, del } from "@vercel/blob";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

export async function updateReportAction(
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
        message: "You must be logged in to update a report.",
      };
    }

    if (session.user.role !== "USER") {
      return {
        success: false,
        message: "Only users can update waste reports.",
      };
    }

    // 2. Collect form data
    const reportId = formData.get("reportId")?.toString() ?? "";
    const removeExistingImage =
      formData.get("removeExistingImage")?.toString() === "true";

    const rawData = {
      title: formData.get("title")?.toString() ?? "",
      description: formData.get("description")?.toString() ?? "",
      category: formData.get("category")?.toString() ?? "",
      address: formData.get("address")?.toString() ?? "",
      latitude: formData.get("latitude")?.toString() ?? "",
      longitude: formData.get("longitude")?.toString() ?? "",
    };

    const imageValue = formData.get("image");
    const image =
      imageValue instanceof File && imageValue.size > 0 ? imageValue : null;

    // 3. Validate report ID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(reportId)) {
      return {
        success: false,
        message: "Invalid report ID.",
      };
    }

    // 4. Validate form data (excluding image)
    const validation = createReportSchema
      .omit({ image: true })
      .safeParse(rawData);

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
        },
      };
    }

    const { title, description, category, address, latitude, longitude } =
      validation.data;

    // 5. Check report ownership
    const existingReport = await prisma.wasteReport.findFirst({
      where: {
        id: reportId,
        userId: session.user.id,
      },
      include: {
        images: {
          select: {
            id: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!existingReport) {
      return {
        success: false,
        message: "Report not found or you do not have permission to update it.",
      };
    }

    // 6. Check category existence
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

    // 7. Validate new image, if provided
    let extension: string | null = null;

    if (image) {
      const allowedExtensions: Record<string, string> = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
      };

      extension = allowedExtensions[image.type] ?? null;

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
    }

    // 8. Upload new image, if provided
    if (image && extension) {
      const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

      if (!blobToken) {
        throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
      }

      const fileName = `${randomUUID()}${extension}`;

      const blob = await put(`reports/${fileName}`, image, {
        access: "public",
        contentType: image.type,
        addRandomSuffix: false,
        token: blobToken,
      });

      uploadedBlobUrl = blob.url;
    }

    // 9. Update report and image records in a transaction
    const oldImageUrls = existingReport.images.map((item) => item.imageUrl);

    await prisma.$transaction(async (tx) => {
      await tx.wasteReport.update({
        where: {
          id: existingReport.id,
        },
        data: {
          title,
          description,
          address,
          latitude,
          longitude,
          confirmedCategoryId: category,
          // Status, userId, and createdAt remain unchanged.
        },
      });

      // Replace the old image with the newly uploaded image.
      if (uploadedBlobUrl) {
        await tx.reportImage.deleteMany({
          where: {
            reportId: existingReport.id,
          },
        });

        await tx.reportImage.create({
          data: {
            reportId: existingReport.id,
            imageUrl: uploadedBlobUrl,
          },
        });
      } else if (removeExistingImage) {
        // Remove existing image only when explicitly requested.
        await tx.reportImage.deleteMany({
          where: {
            reportId: existingReport.id,
          },
        });
      }
    });

    // 10. Delete old Blob files after the database transaction succeeds
    const shouldDeleteOldImages =
      uploadedBlobUrl !== null || removeExistingImage;

    if (shouldDeleteOldImages && oldImageUrls.length > 0) {
      try {
        await del(oldImageUrls);
      } catch (deleteError) {
        // Database update succeeded, so do not report the whole update as failed.
        console.error("Failed to delete old Blob images:", deleteError);
      }
    }

    // 11. Revalidate relevant pages
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath(`/reports/update/${reportId}`);

    return {
      success: true,
      message: "Waste report updated successfully!",
    };
  } catch (error) {
    // 12. Cleanup newly uploaded Blob if database operation fails
    if (uploadedBlobUrl) {
      try {
        await del(uploadedBlobUrl);
      } catch (deleteError) {
        console.error("Failed to delete uploaded Blob:", deleteError);
      }
    }

    console.error("Update report error:", error);

    return {
      success: false,
      message: "Failed to update report. Please try again.",
    };
  }
}
