import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { del } from "@vercel/blob";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 1. Validasi session
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

    // 2. Ambil report ID
    const { id } = await params;

    // Validasi UUID
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

    // 3. Cari report berdasarkan ID dan pemiliknya
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

    // 4. Ambil URL gambar dari Vercel Blob
    const imageUrls = report.images.map((image) => image.imageUrl);

    // 5. Hapus data report dari database
    // Relasi ReportImage akan ikut terhapus jika menggunakan onDelete: Cascade.
    await prisma.wasteReport.delete({
      where: {
        id: report.id,
      },
    });

    // 6. Hapus file gambar dari Vercel Blob
    let blobCleanupSuccess = true;

    if (imageUrls.length > 0) {
      try {
        await del(imageUrls);
      } catch (blobError) {
        blobCleanupSuccess = false;
        console.error("Failed to delete images from Vercel Blob:", blobError);
      }
    }

    return NextResponse.json({
      success: true,
      message: blobCleanupSuccess
        ? "Report and its images deleted successfully."
        : "Report deleted, but some images could not be removed from Blob.",
      data: {
        reportId: report.id,
        deletedImages: imageUrls.length,
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
