import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  try {
    const categories = await prisma.wasteCategory.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Categories retrieved successfully.",
        data: categories,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET CATEGORIES ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve categories.",
      },
      { status: 500 },
    );
  }
}
