import { NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized.",
        },
        { status: 401 },
      );
    }

    const { id } = await params;

    console.log("GET REPORT DATA BY ID:", id);

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
            createdAt: true,
          },
        },
        confirmedCategory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json(
        {
          success: false,
          message: "Report not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Report retrieved successfully.",
      data: report,
    });
  } catch (error) {
    console.error("GET report error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve report.",
      },
      { status: 500 },
    );
  }
}
