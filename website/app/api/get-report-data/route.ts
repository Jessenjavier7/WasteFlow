import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { getMobileUserFromRequest } from "@/app/lib/mobile-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
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

      // Verify the user and role using the database
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

    // 2. Get reports belonging to the authenticated user
    const reports = await prisma.wasteReport.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        address: true,
        status: true,
        createdAt: true,

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

        statusHistories: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
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
      message: "User reports retrieved successfully.",
      data: reports,
    });
  } catch (error) {
    console.error("GET MY REPORTS ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve user reports.",
      },
      { status: 500 },
    );
  }
}
