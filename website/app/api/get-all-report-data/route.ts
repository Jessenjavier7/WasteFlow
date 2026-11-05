import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please login first." },
        { status: 401 },
      );
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Forbidden. Admin access required." },
        { status: 403 },
      );
    }

    const reports = await prisma.wasteReport.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        address: true,
        latitude: true,
        longitude: true,
        status: true,
        createdAt: true,

        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        confirmedCategory: {
          select: {
            name: true,
          },
        },

        images: {
          select: {
            id: true,
            imageUrl: true,
          },
        },

        // Make sure this relation is included
        statusHistories: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            reportId: true,
            changedBy: true,
            oldStatus: true,
            newStatus: true,
            note: true,
            createdAt: true,

            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      message: "All reports retrieved successfully.",
      totalReports: reports.length,
      data: reports,
    });
  } catch (error) {
    console.error("GET /api/admin/reports error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve reports.",
      },
      { status: 500 },
    );
  }
}
