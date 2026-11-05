import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

const allowedStatuses = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
] as const;

type ReportStatus = (typeof allowedStatuses)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 1. Validate session
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 },
      );
    }

    // 2. Validate Admin role
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Forbidden. Admin access required." },
        { status: 403 },
      );
    }

    // 3. Get report ID
    const { id: reportId } = await params;

    // 4. Validate request body
    const body = await request.json();
    const status = body.status;

    if (
      typeof status !== "string" ||
      !allowedStatuses.includes(status as ReportStatus)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid report status." },
        { status: 400 },
      );
    }

    const newStatus = status as ReportStatus;

    // 5. Update status and record history atomically
    const result = await prisma.$transaction(async (tx) => {
      // Check whether report exists
      const existingReport = await tx.wasteReport.findUnique({
        where: { id: reportId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!existingReport) {
        throw new Error("REPORT_NOT_FOUND");
      }

      // Avoid creating duplicate history
      if (existingReport.status === newStatus) {
        return {
          report: existingReport,
          historyCreated: false,
        };
      }

      // Update report status
      const updatedReport = await tx.wasteReport.update({
        where: { id: reportId },
        data: {
          status: newStatus,
        },
        select: {
          id: true,
          status: true,
          updatedAt: true,
        },
      });

      // Create status history
      await tx.reportStatusHistory.create({
        data: {
          reportId: reportId,
          changedBy: session.user.id,
          oldStatus: existingReport.status,
          newStatus: newStatus,
          note: null,
        },
      });

      return {
        report: updatedReport,
        historyCreated: true,
      };
    });

    return NextResponse.json({
      success: true,
      message: result.historyCreated
        ? "Report status updated and history recorded successfully."
        : "Report already has the selected status. No changes were made.",
      data: result.report,
      historyCreated: result.historyCreated,
    });
  } catch (error) {
    console.error("UPDATE REPORT STATUS ERROR:", error);

    if (error instanceof Error && error.message === "REPORT_NOT_FOUND") {
      return NextResponse.json(
        { success: false, message: "Report not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update report status.",
      },
      { status: 500 },
    );
  }
}
