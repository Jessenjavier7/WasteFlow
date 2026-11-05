import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    // 1. Get current login session
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

    const userId = session.user.id;

    console.log(userId);

    // 2. Get report statistics
    const [totalReports, pendingReports, completedReports] = await Promise.all([
      prisma.wasteReport.count(),

      prisma.wasteReport.count({
        where: {
          status: "PENDING",
        },
      }),

      prisma.wasteReport.count({
        where: {
          status: "COMPLETED",
        },
      }),
    ]);

    // 3. Return response
    return NextResponse.json({
      success: true,
      message: "Report statistics retrieved successfully.",
      data: {
        totalReports,
        pendingReports,
        completedReports,
      },
    });
  } catch (error) {
    console.error("GET my report statistics error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve report statistics.",
      },
      { status: 500 },
    );
  }
}
