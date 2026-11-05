"use client";

import Swal from "sweetalert2";
import { useRouter } from "next/navigation";

import {
  Pencil,
  Trash2,
  MapPin,
  CalendarDays,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  History,
  UserRound,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";
import type { MyReportsSectionProps } from "../type/my-report-section-props";

// Define allowed report statuses
type ReportStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";

// Status configuration
const statusConfig: Record<
  ReportStatus,
  {
    label: string;
    className: string;
    icon: LucideIcon;
  }
> = {
  PENDING: {
    label: "Pending",
    className: "bg-rose-50 text-rose-600",
    icon: Clock,
  },
  IN_PROGRESS: {
    label: "In Progress",
    className: "bg-amber-50 text-amber-700",
    icon: AlertCircle,
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-gray-100 text-gray-600",
    icon: AlertCircle,
  },
};

// Safely retrieve status configuration
const getStatusConfig = (status: string | null | undefined) => {
  if (!status || !(status in statusConfig)) {
    return statusConfig.PENDING;
  }

  return statusConfig[status as ReportStatus];
};

// Get readable status label
const getStatusLabel = (status: string | null | undefined) => {
  if (!status) return "No Previous Status";

  if (!(status in statusConfig)) return status;

  return statusConfig[status as ReportStatus].label;
};

export default function MyReportsSection({
  reports,
  isLoading,
  error,
  search,
  onDeleteSuccess,
}: MyReportsSectionProps) {
  const router = useRouter();

  const safeReports = Array.isArray(reports) ? reports : [];

  // Filter reports
  const filteredReports = safeReports.filter((report) =>
    `${report.title} ${report.description ?? ""} ${
      report.address ?? ""
    } ${report.confirmedCategory?.name ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  // Format date
  const formatDate = (date: string | Date) => {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  // Delete report
  const handleDelete = async (reportId: string) => {
    const confirmation = await Swal.fire({
      title: "Are you sure?",
      text: "This report and its images will be permanently deleted.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });

    if (!confirmation.isConfirmed) return;

    try {
      Swal.fire({
        title: "Deleting Report...",
        text: "Please wait while we delete your report.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const response = await fetch(`/api/delete-report/${reportId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to delete report.");
      }

      onDeleteSuccess(reportId);

      await Swal.fire({
        title: "Deleted!",
        text: "Your report has been successfully deleted.",
        icon: "success",
        confirmButtonColor: "#059669",
        confirmButtonText: "OK",
      });
    } catch (error) {
      console.error("Delete report error:", error);

      Swal.fire({
        title: "Delete Failed!",
        text:
          error instanceof Error
            ? error.message
            : "Something went wrong while deleting the report.",
        icon: "error",
        confirmButtonColor: "#dc2626",
      });
    }
  };

  // Navigate to update page
  const handleUpdate = (reportId: string) => {
    router.push(`/reports/update/${reportId}`);
  };

  return (
    <section>
      {isLoading ? (
        <div className="flex min-h-[250px] flex-col items-center justify-center gap-3">
          <LoaderCircle size={32} className="animate-spin text-emerald-600" />
          <p className="text-sm text-gray-400">Loading your reports...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      ) : safeReports.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white">
            <FileText size={28} className="text-gray-400" />
          </div>

          <h3 className="text-lg font-bold text-gray-900">No Reports Yet</h3>

          <p className="mt-2 max-w-sm text-sm text-gray-400">
            You have not submitted any waste reports. Create your first report
            to get started.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing{" "}
              <span className="font-bold text-gray-900">
                {filteredReports.length}
              </span>{" "}
              of{" "}
              <span className="font-bold text-gray-900">
                {safeReports.length}
              </span>{" "}
              reports
            </p>
          </div>

          {filteredReports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-400">
              No reports match your search.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => {
                const status = getStatusConfig(report.status);
                const StatusIcon = status.icon;

                return (
                  <article
                    key={report.id}
                    className="overflow-hidden rounded-2xl border border-gray-100 bg-white transition hover:border-gray-200 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 p-5 sm:flex-row">
                      {/* Report Image */}
                      <div className="h-40 w-full shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-28 sm:w-36">
                        {report.images?.[0]?.imageUrl ? (
                          <img
                            src={report.images[0].imageUrl}
                            alt={report.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <FileText size={30} className="text-gray-300" />
                          </div>
                        )}
                      </div>

                      {/* Report Information */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-bold text-gray-900">
                              {report.title}
                            </h3>

                            <p className="mt-1 text-xs text-gray-400">
                              ID: {report.id}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            {/* Report Status */}
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${status.className}`}
                            >
                              <StatusIcon size={13} />
                              {status.label}
                            </span>

                            {/* Update Button */}
                            <button
                              type="button"
                              onClick={() => handleUpdate(report.id)}
                              title="Edit report"
                              aria-label={`Edit report ${report.title}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 text-blue-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Pencil size={15} />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDelete(report.id)}
                              title="Delete report"
                              aria-label={`Delete report ${report.title}`}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {report.description && (
                          <p className="mt-3 line-clamp-2 text-sm text-gray-500">
                            {report.description}
                          </p>
                        )}

                        {/* Additional Information */}
                        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-400">
                          <span className="flex items-center gap-1.5">
                            <FileText size={14} />
                            {report.confirmedCategory?.name ?? "Uncategorized"}
                          </span>

                          <span className="flex items-center gap-1.5">
                            <MapPin size={14} />
                            <span className="max-w-[220px] truncate">
                              {report.address ?? "No address"}
                            </span>
                          </span>

                          <span className="flex items-center gap-1.5">
                            <CalendarDays size={14} />
                            {formatDate(report.createdAt)}
                          </span>
                        </div>

                        {/* Status History */}
                        <div className="mt-5 border-t border-gray-100 pt-4">
                          <div className="mb-4 flex items-center gap-2">
                            <History size={16} className="text-emerald-600" />

                            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                              Status History
                            </h4>

                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                              {report.statusHistories?.length ?? 0}
                            </span>
                          </div>

                          {report.statusHistories?.length ? (
                            <div className="space-y-3">
                              {report.statusHistories.map((history) => {
                                const newStatusConfig = getStatusConfig(
                                  history.newStatus,
                                );

                                return (
                                  <div
                                    key={history.id}
                                    className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                                  >
                                    {/* Admin Information */}
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <UserRound
                                          size={15}
                                          className="shrink-0 text-gray-400"
                                        />

                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold text-gray-700">
                                            {history.user?.name ??
                                              "Unknown Admin"}
                                          </p>

                                          <p className="truncate text-[11px] text-gray-400">
                                            {history.user?.email ??
                                              history.changedBy}
                                          </p>
                                        </div>
                                      </div>

                                      <span className="text-[11px] text-gray-400">
                                        {formatDate(history.createdAt)}
                                      </span>
                                    </div>

                                    {/* Old Status -> New Status */}
                                    <div className="mt-3">
                                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        Status Changed
                                      </p>

                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600">
                                          {getStatusLabel(history.oldStatus)}
                                        </span>

                                        <span className="text-gray-400">→</span>

                                        <span
                                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${newStatusConfig.className}`}
                                        >
                                          {newStatusConfig.label}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Admin Note */}
                                    {history.note && (
                                      <div className="mt-3 rounded-lg border border-gray-100 bg-white p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                          Admin Note
                                        </p>

                                        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-gray-600">
                                          {history.note}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-xl bg-gray-50 px-4 py-5 text-center">
                              <Clock
                                size={20}
                                className="mx-auto mb-2 text-gray-300"
                              />

                              <p className="text-xs text-gray-400">
                                No status changes have been recorded yet.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
