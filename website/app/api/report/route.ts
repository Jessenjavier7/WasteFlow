import { NextRequest, NextResponse } from "next/server";

import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { createReportSchema } from "@/app/validation/zod";

import { put, del } from "@vercel/blob";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let uploadedBlobUrl: string | null = null;

  try {
    // 1. Authentication
    const authorization = request.headers.get("authorization");

    let userId: string | null = null;

    if (authorization !== null) {
      // Mobile authentication using Bearer Token
      if (!authorization.startsWith("Bearer ")) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid authorization format.",
          },
          { status: 401 },
        );
      }

      const mobileUser = await getMobileUserFromRequest(request);

      if (!mobileUser) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid or expired mobile token. Please login again.",
          },
          { status: 401 },
        );
      }

      userId = mobileUser.userId;
    } else {
      // Website authentication using Auth.js session
      const session = await auth();

      if (!session?.user?.id) {
        return NextResponse.json(
          {
            success: false,
            message: "Unauthorized. Please log in.",
          },
          { status: 401 },
        );
      }

      userId = session.user.id;
    }

    // 2. Verify current user and role from database
    const currentUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json(
        {
          success: false,
          message: "User account not found.",
        },
        { status: 401 },
      );
    }

    if (String(currentUser.role).toUpperCase() !== "USER") {
      return NextResponse.json(
        {
          success: false,
          message: "Only users can submit waste reports.",
        },
        { status: 403 },
      );
    }

    // 3. Read multipart form data
    const formData = await request.formData();

    const rawData = {
      title: formData.get("title"),
      description: formData.get("description"),
      category: formData.get("category"),
      address: formData.get("address"),
      latitude: formData.get("latitude"),
      longitude: formData.get("longitude"),
      image: formData.get("image"),
    };

    // 4. Validate request data
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

      return NextResponse.json(
        {
          success: false,
          message: "Please check the submitted fields.",
          errors: {
            title: errors.title?.[0],
            description: errors.description?.[0],
            category: errors.category?.[0],
            address: errors.address?.[0],
            latitude: errors.latitude?.[0],
            longitude: errors.longitude?.[0],
            image: errors.image?.[0],
          },
        },
        { status: 400 },
      );
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

    // 5. Check category
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

    // 6. Validate image format and size
    const allowedExtensions: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
    };

    const extension = allowedExtensions[image.type];

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

    // 7. Upload one image to Vercel Blob
    const fileName = `${randomUUID()}${extension}`;

    const blob = await put(`reports/${fileName}`, image, {
      access: "public",
      contentType: image.type,
      addRandomSuffix: false,
    });

    uploadedBlobUrl = blob.url;

    // 8. Save report, image, and status history
    const report = await prisma.$transaction(async (tx) => {
      const newReport = await tx.wasteReport.create({
        data: {
          title,
          description,
          address,
          latitude,
          longitude,
          status: "PENDING",
          userId: currentUser.id,
          confirmedCategoryId: category,
        },
      });

      const reportImage = await tx.reportImage.create({
        data: {
          reportId: newReport.id,
          imageUrl: blob.url,
        },
      });

      await tx.reportStatusHistory.create({
        data: {
          reportId: newReport.id,
          changedBy: currentUser.id,
          oldStatus: null,
          newStatus: "PENDING",
          note: "Report submitted.",
        },
      });

      return {
        ...newReport,
        images: [reportImage],
      };
    });

    // 9. Success response
    return NextResponse.json(
      {
        success: true,
        message: "Waste report submitted successfully!",
        data: {
          id: report.id,
          title: report.title,
          description: report.description,
          categoryId: report.confirmedCategoryId,
          address: report.address,
          latitude: report.latitude,
          longitude: report.longitude,
          status: report.status,
          images: report.images.map((item) => ({
            id: item.id,
            imageUrl: item.imageUrl,
          })),
          createdAt: report.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    // 10. Cleanup Blob if database operation fails
    if (uploadedBlobUrl) {
      try {
        await del(uploadedBlobUrl);
      } catch (deleteError) {
        console.error("Failed to delete uploaded Blob:", deleteError);
      }
    }

    console.error("Create report API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to submit report. Please try again.",
      },
      { status: 500 },
    );
  }
}
