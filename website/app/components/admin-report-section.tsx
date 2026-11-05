"use client";

import {
  MapPin,
  CalendarDays,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  UserRound,
  History,
  Search,
  X,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";
import type { AdminReport } from "../type/admin_report";
import type { AdminReportsSectionProps } from "../type/admin_report_section_props";

const statusConfig = {
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

export default function AdminReportsSection({
  reports,
  isLoading,
  error,
  search,
}: AdminReportsSectionProps) {
  // Local reports state
  const [localReports, setLocalReports] = useState<AdminReport[]>(reports);

  const [searchQuery, setSearchQuery] = useState(search ?? "");

  // Update status state
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState("");
  const [updateSuccess, setUpdateSuccess] = useState("");

  const getStatusLabel = (status: string | null) => {
    if (!status) return "No Previous Status";

    return statusConfig[status as keyof typeof statusConfig]?.label ?? status;
  };

  // Synchronize local state when parent reports change
  useEffect(() => {
    setLocalReports(reports);
  }, [reports]);

  useEffect(() => {
    setSearchQuery(search ?? "");
  }, [search]);

  // Filter reports
  const filteredReports = useMemo(() => {
    const keyword = searchQuery.toLowerCase().trim();

    if (!keyword) return localReports;

    return localReports.filter((report) => {
      const searchableData = [
        report.id,
        report.title,
        report.description,
        report.address,
        report.confirmedCategory?.name,
        report.status,
        report.user?.id,
        report.user?.name,
        report.user?.email,

        // Search through status history
        ...(report.statusHistories ?? []).flatMap((history) => [
          history.changedBy,
          history.oldStatus,
          history.newStatus,
          history.note,
          history.user?.name,
          history.user?.email,
        ]),
      ];

      return searchableData.some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(keyword),
      );
    });
  }, [localReports, searchQuery]);

  // Date formatter
  const formatDate = (date: string | Date) => {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  // Update report status
  const handleStatusChange = async (
    reportId: string,
    newStatus: AdminReport["status"],
  ) => {
    try {
      setUpdatingReportId(reportId);
      setUpdateError("");
      setUpdateSuccess("");

      const response = await fetch(`/api/update-report-status/${reportId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update report status.");
      }

      // Update local report status after successful API response
      setLocalReports((prevReports) =>
        prevReports.map((report) =>
          report.id === reportId
            ? {
                ...report,
                status: result.data.status,
              }
            : report,
        ),
      );

      setUpdateSuccess("Report status updated successfully.");
    } catch (error) {
      console.error("UPDATE REPORT STATUS ERROR:", error);

      setUpdateError(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setUpdatingReportId(null);
    }
  };

  return (
    <section>
      {/* Loading */}
      {isLoading ? (
        <div className="flex min-h-[250px] flex-col items-center justify-center gap-3">
          <LoaderCircle size={32} className="animate-spin text-emerald-600" />
          <p className="text-sm text-gray-400">Loading all reports...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      ) : (
        <>
          {/* Update feedback */}
          {updateError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
              {updateError}
            </div>
          )}

          {updateSuccess && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {updateSuccess}
            </div>
          )}

          {/* Search Bar */}
          <div className="mb-5">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reports by title, ID, user, category, status..."
                className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-11 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />

              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  title="Clear search"
                  aria-label="Clear search"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-700"
                >
                  <X size={17} />
                </button>
              )}
            </div>
          </div>

          {/* Empty reports */}
          {localReports.length === 0 && !searchQuery.trim() ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white">
                <FileText size={28} className="text-gray-400" />
              </div>

              <h3 className="text-lg font-bold text-gray-900">
                No Reports Yet
              </h3>

              <p className="mt-2 max-w-sm text-sm text-gray-400">
                There are currently no waste reports submitted by users.
              </p>
            </div>
          ) : (
            <>
              {/* Report count */}
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing{" "}
                  <span className="font-bold text-gray-900">
                    {filteredReports.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-gray-900">
                    {localReports.length}
                  </span>{" "}
                  reports
                </p>
              </div>

              {/* No search results */}
              {filteredReports.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-400">
                  No reports match your search.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredReports.map((report) => {
                    const status =
                      statusConfig[report.status] ?? statusConfig.PENDING;

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

                              {/* Current Status */}
                              <span
                                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${status.className}`}
                              >
                                <StatusIcon size={13} />
                                {status.label}
                              </span>
                            </div>

                            {/* Report Owner */}
                            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-3">
                              <UserRound
                                size={16}
                                className="shrink-0 text-gray-400"
                              />

                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-700">
                                  {report.user?.name ?? "Unnamed User"}
                                </p>

                                <p className="truncate text-xs text-gray-400">
                                  {report.user?.email}
                                </p>
                              </div>
                            </div>

                            {/* Description */}
                            {report.description && (
                              <p className="mt-3 line-clamp-2 text-sm text-gray-500">
                                {report.description}
                              </p>
                            )}

                            {/* Additional Information */}
                            <div className="mt-4 space-y-3 text-xs text-gray-500">
                              {/* Category */}
                              <div className="flex items-center gap-2">
                                <FileText
                                  size={14}
                                  className="shrink-0 text-gray-400"
                                />
                                <span>
                                  {report.confirmedCategory?.name ??
                                    "Uncategorized"}
                                </span>
                              </div>

                              {/* Full Address */}
                              <div className="flex items-start gap-2">
                                <MapPin
                                  size={14}
                                  className="mt-0.5 shrink-0 text-gray-400"
                                />

                                <div className="min-w-0">
                                  <p className="font-semibold text-gray-600">
                                    Full Address
                                  </p>

                                  <p className="mt-1 whitespace-normal break-words leading-relaxed">
                                    {report.address ?? "No address provided"}
                                  </p>
                                </div>
                              </div>

                              {/* Latitude and Longitude */}
                              <div className="flex items-start gap-2">
                                <MapPin
                                  size={14}
                                  className="mt-0.5 shrink-0 text-gray-400"
                                />

                                <div>
                                  <p className="font-semibold text-gray-600">
                                    Coordinates
                                  </p>

                                  {report.latitude !== null &&
                                  report.longitude !== null ? (
                                    <p className="mt-1 font-mono text-gray-500">
                                      Latitude: {report.latitude}
                                      <br />
                                      Longitude: {report.longitude}
                                    </p>
                                  ) : (
                                    <p className="mt-1 text-gray-400">
                                      Coordinates not available
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Created Date */}
                              <div className="flex items-center gap-2">
                                <CalendarDays
                                  size={14}
                                  className="shrink-0 text-gray-400"
                                />
                                <span>{formatDate(report.createdAt)}</span>
                              </div>
                            </div>

                            {/* Status History */}
                            <div className="mt-5 border-t border-gray-100 pt-4">
                              <div className="mb-4 flex items-center gap-2">
                                <History
                                  size={16}
                                  className="text-emerald-600"
                                />

                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                  Status History
                                </h4>

                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                                  {report.statusHistories?.length ?? 0}
                                </span>
                              </div>

                              {report.statusHistories?.length ? (
                                <div className="space-y-4">
                                  {report.statusHistories.map((history) => (
                                    <div
                                      key={history.id}
                                      className="relative rounded-xl border border-gray-100 bg-gray-50 p-4"
                                    >
                                      {/* Changed By */}
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
                                      <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <span className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600">
                                          {getStatusLabel(history.oldStatus)}
                                        </span>

                                        <span className="text-gray-400">→</span>

                                        <span
                                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                                            statusConfig[history.newStatus]
                                              .className
                                          }`}
                                        >
                                          {getStatusLabel(history.newStatus)}
                                        </span>
                                      </div>

                                      {/* Changed By ID */}
                                      <p className="mt-3 break-all text-[10px] text-gray-400">
                                        Admin ID: {history.changedBy}
                                      </p>

                                      {/* Note */}
                                      {history.note && (
                                        <div className="mt-3 rounded-lg bg-white p-3">
                                          <p className="text-[10px] font-bold uppercase text-gray-400">
                                            Note
                                          </p>

                                          <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600">
                                            {history.note}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="rounded-xl bg-gray-50 px-4 py-5 text-center text-xs text-gray-400">
                                  No status changes have been recorded yet.
                                </p>
                              )}
                            </div>

                            {/* Update Report Status */}
                            <div className="mt-5 border-t border-gray-100 pt-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                    Update Report Status
                                  </p>

                                  <p className="mt-1 text-sm text-gray-500">
                                    Change the current report status.
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  {updatingReportId === report.id && (
                                    <LoaderCircle
                                      size={16}
                                      className="animate-spin text-emerald-600"
                                    />
                                  )}

                                  <select
                                    value={report.status}
                                    disabled={updatingReportId === report.id}
                                    onChange={(e) =>
                                      handleStatusChange(
                                        report.id,
                                        e.target.value as AdminReport["status"],
                                      )
                                    }
                                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-none transition focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <option value="PENDING">Pending</option>
                                    <option value="IN_PROGRESS">
                                      In Progress
                                    </option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="REJECTED">Rejected</option>
                                  </select>
                                </div>
                              </div>
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
        </>
      )}
    </section>
  );
}
