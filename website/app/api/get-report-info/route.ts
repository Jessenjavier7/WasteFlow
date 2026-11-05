import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    let userId: string | null = null;

    // 1. Authenticate mobile or website user
    const authorization = request.headers.get("authorization");

    if (authorization) {
      // Mobile authentication using Bearer Token
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

      // Verify current user and role from database
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
      // Website authentication using Auth.js
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

    // 2. Get report statistics
    const [totalReports, pendingReports, completedReports] = await Promise.all([
      prisma.wasteReport.count({
        where: {
          userId,
        },
      }),

      prisma.wasteReport.count({
        where: {
          userId,
          status: "PENDING",
        },
      }),

      prisma.wasteReport.count({
        where: {
          userId,
          status: "COMPLETED",
        },
      }),
    ]);

    // 3. Return statistics
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
    console.error("GET MY REPORT STATISTICS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve report statistics.",
      },
      { status: 500 },
    );
  }
}
