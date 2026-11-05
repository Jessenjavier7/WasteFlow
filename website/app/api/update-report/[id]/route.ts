import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { createReportSchema } from "@/app/validation/zod";

import { put, del } from "@vercel/blob";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

// PATCH /api/update-report/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let uploadedBlobUrl: string | null = null;

  try {
    // 1. Check authentication
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          message: "You must be logged in to update a report.",
        },
        { status: 401 },
      );
    }

    if (session.user.role !== "USER") {
      return NextResponse.json(
        {
          success: false,
          message: "Only users can update waste reports.",
        },
        { status: 403 },
      );
    }

    // 2. Get report ID from URL
    const { id: reportId } = await params;

    // 3. Validate report ID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(reportId)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid report ID.",
        },
        { status: 400 },
      );
    }

    // 4. Collect form data
    const formData = await request.formData();

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

    // 5. Validate form data
    const validation = createReportSchema
      .omit({ image: true })
      .safeParse(rawData);

    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;

      return NextResponse.json(
        {
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
        },
        { status: 400 },
      );
    }

    const { title, description, category, address, latitude, longitude } =
      validation.data;

    // 6. Check report ownership
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
      return NextResponse.json(
        {
          success: false,
          message:
            "Report not found or you do not have permission to update it.",
        },
        { status: 404 },
      );
    }

    // 7. Check category existence
    const existingCategory = await prisma.wasteCategory.findUnique({
      where: {
        id: category,
      },
      select: {
        id: true,
      },
    });

    if (!existingCategory) {
      return NextResponse.json(
        {
          success: false,
          message: "Selected waste category does not exist.",
          errors: {
            category: "Please select a valid category.",
          },
        },
        { status: 400 },
      );
    }

    // 8. Validate new image
    const allowedExtensions: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
    };

    let extension: string | null = null;

    if (image) {
      extension = allowedExtensions[image.type] ?? null;

      if (!extension || image.size > 4 * 1024 * 1024) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid image file.",
            errors: {
              image: !extension
                ? "Only JPEG, PNG, and WebP images are allowed."
                : "Maximum image size is 4 MB.",
            },
          },
          { status: 400 },
        );
      }
    }

    // 9. Get Vercel Blob token
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    // Validate token only when Blob operations are required
    if ((image || removeExistingImage) && !blobToken) {
      console.error("BLOB_READ_WRITE_TOKEN is not configured.");

      return NextResponse.json(
        {
          success: false,
          message:
            "Blob storage is not configured. Please contact the administrator.",
        },
        { status: 500 },
      );
    }

    // 10. Upload new image if provided
    if (image && extension && blobToken) {
      const fileName = `${randomUUID()}${extension}`;

      const blob = await put(`reports/${fileName}`, image, {
        access: "public",
        contentType: image.type,
        addRandomSuffix: false,
        token: blobToken,
      });

      uploadedBlobUrl = blob.url;
    }

    // 11. Update report and image records in transaction
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

      // Replace existing image with new image
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
        // Remove existing image only when explicitly requested
        await tx.reportImage.deleteMany({
          where: {
            reportId: existingReport.id,
          },
        });
      }
    });

    // 12. Delete old Blob images after transaction succeeds
    const shouldDeleteOldImages =
      uploadedBlobUrl !== null || removeExistingImage;

    if (shouldDeleteOldImages && oldImageUrls.length > 0 && blobToken) {
      try {
        await del(oldImageUrls, {
          token: blobToken,
        });
      } catch (deleteError) {
        // Database update already succeeded
        console.error("Failed to delete old Blob images:", deleteError);
      }
    }

    // 13. Revalidate relevant pages
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidatePath(`/reports/update/${reportId}`);

    // 14. Return success response
    return NextResponse.json(
      {
        success: true,
        message: "Waste report updated successfully!",
      },
      { status: 200 },
    );
  } catch (error) {
    // 15. Cleanup uploaded Blob if database operation fails
    if (uploadedBlobUrl) {
      const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

      if (blobToken) {
        try {
          await del(uploadedBlobUrl, {
            token: blobToken,
          });
        } catch (deleteError) {
          console.error("Failed to delete uploaded Blob:", deleteError);
        }
      }
    }

    console.error("Update report API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update report. Please try again.",
      },
      { status: 500 },
    );
  }
}
