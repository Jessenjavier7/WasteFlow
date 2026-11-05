import { NextResponse } from "next/server";

import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

import { del } from "@vercel/blob";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 1. Validate session
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

    // 5. Validate Vercel Blob token before deleting database records
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
    // Related ReportImage and status history records
    // will be deleted if onDelete: Cascade is configured.
    await prisma.wasteReport.delete({
      where: {
        id: report.id,
      },
    });

    // 7. Delete images from Vercel Blob using environment token
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
