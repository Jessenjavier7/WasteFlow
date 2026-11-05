import { NextResponse } from "next/server";

import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

import { del } from "@vercel/blob";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    let userId: string | null = null;

    // 1. Authentication: Mobile Bearer Token or Website Auth.js Session
    const authorization = request.headers.get("authorization");

    if (authorization) {
      // Mobile authentication
      if (!authorization.startsWith("Bearer ")) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid authorization header.",
          },
          { status: 401 },
        );
      }

      const mobileUser = await getMobileUserFromRequest(request);

      if (!mobileUser) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid or expired access token.",
          },
          { status: 401 },
        );
      }

      // Verify user and role using database
      const user = await prisma.user.findUnique({
        where: {
          id: mobileUser.userId,
        },
        select: {
          id: true,
          role: true,
        },
      });

      if (!user || user.role !== "USER") {
        return NextResponse.json(
          {
            success: false,
            message: "Unauthorized access.",
          },
          { status: 403 },
        );
      }

      userId = user.id;
    } else {
      // Website authentication
      const session = await auth();

      if (!session?.user?.id) {
        return NextResponse.json(
          {
            success: false,
            message: "Unauthorized. Please login first.",
          },
          { status: 401 },
        );
      }

      userId = session.user.id;
    }

    // 2. Get report ID
    const { id } = await params;

    // Validate UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid report ID.",
        },
        { status: 400 },
      );
    }

    // 3. Find report and verify ownership
    const report = await prisma.wasteReport.findFirst({
      where: {
        id,
        userId,
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

    if (!report) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Report not found or you do not have permission to delete it.",
        },
        { status: 404 },
      );
    }

    // 4. Get image URLs
    const imageUrls = report.images.map((image) => image.imageUrl);

    // 5. Validate Blob token before deleting database records
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    if (imageUrls.length > 0 && !blobToken) {
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

    // 6. Delete report from database
    await prisma.wasteReport.delete({
      where: {
        id: report.id,
      },
    });

    // 7. Delete images from Vercel Blob
    let blobCleanupSuccess = true;

    if (imageUrls.length > 0 && blobToken) {
      try {
        await del(imageUrls, {
          token: blobToken,
        });
      } catch (blobError) {
        blobCleanupSuccess = false;

        console.error("Failed to delete images from Vercel Blob:", blobError);
      }
    }

    // 8. Return response
    return NextResponse.json({
      success: true,
      message: blobCleanupSuccess
        ? "Report and its images deleted successfully."
        : "Report deleted, but some images could not be removed from Blob.",
      data: {
        reportId: report.id,
        deletedImages: blobCleanupSuccess ? imageUrls.length : 0,
        blobCleanupSuccess,
      },
    });
  } catch (error) {
    console.error("DELETE report error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete report.",
      },
      { status: 500 },
    );
  }
}
