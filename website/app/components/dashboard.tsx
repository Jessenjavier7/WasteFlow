"use client";

import { WasteCategory } from "../type/wasteCategory";

import AdminReportsSection from "./admin-report-section";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { UserData } from "../type/userData";

import MyReportsSection from "@/app/components/my-report-section";
import type { MyReport } from "../type/report";

import {
  LayoutDashboard,
  MapPin,
  FileText,
  Users,
  Recycle,
  Settings,
  LogOut,
  Search,
  Plus,
  TrendingUp,
  Clock,
  CheckCircle2,
  Menu,
  X,
  ArrowUpRight,
  Trash2,
  LoaderCircle,
} from "lucide-react";
import { AdminReport } from "../type/admin_report";

// ==========================================
// NAVIGATION
// ==========================================

const navigationAdmin = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Manage Reports", icon: FileText },
  { label: "Categories", icon: Recycle },
  { label: "Users", icon: Users },
];

const navigationUser = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "My Reports", icon: FileText },
  { label: "Create Report", icon: FileText },
];

// ==========================================
// STATUS CONFIGURATION
// ==========================================

const statusConfig = {
  PENDING: {
    label: "Pending",
    color: "bg-rose-50 text-rose-600",
    dot: "bg-rose-400",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "bg-amber-50 text-amber-700",
    dot: "bg-amber-400",
  },
  COMPLETED: {
    label: "Completed",
    color: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    label: "Rejected",
    color: "bg-gray-100 text-gray-600",
    dot: "bg-gray-400",
  },
};

// ==========================================
// COMPONENT
// ==========================================

export default function Dashboard(props: DashboardClientProps) {
  const { user } = props;
  // console.log(user);
  const router = useRouter();

  let apiEndpoint = "/api/get-report-info";

  // Categories
  const [categories, setCategories] = useState<WasteCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [categoryError, setCategoryError] = useState("");

  // Users
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userError, setUserError] = useState("");

  // Dashboard statistics
  const [totalReports, setTotalReports] = useState(0);
  const [totalPendingReports, setTotalPendingReports] = useState(0);
  const [totalCompletedReports, setTotalCompletedReports] = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  //Report Data
  const [allReports, setAllReports] = useState<AdminReport[]>([]);
  const [isLoadingAllReports, setIsLoadingAllReports] = useState(false);
  const [allReportsError, setAllReportsError] = useState("");

  // Navigation
  const [activeMenu, setActiveMenu] = useState("Dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Search and map
  const [search, setSearch] = useState("");
  const [distance, setDistance] = useState(4);

  // Reports
  const [myReports, setMyReports] = useState<MyReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [reportError, setReportError] = useState("");

  const navigation = user.role === "ADMIN" ? navigationAdmin : navigationUser;

  // ==========================================
  // FETCH Report Data
  // ==========================================

  useEffect(() => {
    if (user.role !== "ADMIN" || activeMenu !== "Manage Reports") {
      return;
    }

    let isMounted = true;

    const fetchAllReports = async () => {
      try {
        setIsLoadingAllReports(true);
        setAllReportsError("");

        const response = await fetch("/api/get-all-report-data");
        const result = await response.json();

        console.log(result.data);

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to fetch all reports.");
        }

        if (!isMounted) return;

        setAllReports(Array.isArray(result.data) ? result.data : []);
      } catch (error) {
        console.error("FETCH ALL REPORTS ERROR:", error);

        if (isMounted) {
          setAllReportsError(
            error instanceof Error ? error.message : "Something went wrong.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingAllReports(false);
        }
      }
    };

    fetchAllReports();

    return () => {
      isMounted = false;
    };
  }, [user.role, activeMenu]);

  // ==========================================
  // FETCH DASHBOARD STATISTICS
  // ==========================================

  useEffect(() => {
    let isMounted = true;

    const fetchReportInfo = async () => {
      try {
        setIsLoadingStats(true);

        if (user.role == "ADMIN") {
          apiEndpoint = "/api/get-report-info-admin";
        }

        const response = await fetch(apiEndpoint);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Failed to fetch report information.",
          );
        }

        if (!isMounted) return;

        setTotalReports(result.data.totalReports ?? 0);
        setTotalPendingReports(result.data.pendingReports ?? 0);
        setTotalCompletedReports(result.data.completedReports ?? 0);
      } catch (error) {
        console.error("FETCH REPORTS INFO ERROR:", error);
      } finally {
        if (isMounted) {
          setIsLoadingStats(false);
        }
      }
    };

    fetchReportInfo();

    return () => {
      isMounted = false;
    };
  }, [activeMenu]);

  // ==========================================
  // FETCH USER REPORTS
  // ==========================================

  useEffect(() => {
    if (user.role !== "USER") return;

    let isMounted = true;

    const fetchMyReports = async () => {
      try {
        setIsLoadingReports(true);
        setReportError("");

        const response = await fetch("/api/get-report-data");
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to fetch your reports.");
        }

        if (!isMounted) return;

        // Expected API response:
        // { success: true, data: [...] }
        setMyReports(Array.isArray(result.data) ? result.data : []);
      } catch (error) {
        console.error("FETCH MY REPORTS ERROR:", error);

        if (isMounted) {
          setReportError(
            error instanceof Error ? error.message : "Something went wrong.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingReports(false);
        }
      }
    };

    fetchMyReports();

    return () => {
      isMounted = false;
    };
  }, [user.role]);

  // ==========================================
  // FETCH ALL USERS
  // ==========================================

  useEffect(() => {
    if (user.role !== "ADMIN" || activeMenu !== "Users") return;

    let isMounted = true;

    const fetchUsers = async () => {
      try {
        setIsLoadingUsers(true);
        setUserError("");

        const response = await fetch("/api/get-users");
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to fetch users.");
        }

        if (!isMounted) return;

        setUsers(Array.isArray(result.data) ? result.data : []);
      } catch (error) {
        console.error("FETCH USERS ERROR:", error);

        if (isMounted) {
          setUserError(
            error instanceof Error ? error.message : "Something went wrong.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingUsers(false);
        }
      }
    };

    fetchUsers();

    return () => {
      isMounted = false;
    };
  }, [user.role, activeMenu]);

  // ==========================================
  // FETCH ALL CATEGORIES
  // ==========================================

  useEffect(() => {
    if (user.role !== "ADMIN" || activeMenu !== "Categories") {
      return;
    }

    let isMounted = true;

    const fetchCategories = async () => {
      try {
        setIsLoadingCategories(true);
        setCategoryError("");

        const response = await fetch("/api/get-categories");
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Failed to fetch categories.");
        }

        if (!isMounted) return;

        setCategories(Array.isArray(result.data) ? result.data : []);
      } catch (error) {
        console.error("FETCH CATEGORIES ERROR:", error);

        if (isMounted) {
          setCategoryError(
            error instanceof Error ? error.message : "Something went wrong.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingCategories(false);
        }
      }
    };

    fetchCategories();

    return () => {
      isMounted = false;
    };
  }, [user.role, activeMenu]);

  // ==========================================
  // DELETE REPORT SUCCESS CALLBACK
  // ==========================================

  const handleDeleteSuccess = useCallback((reportId: string) => {
    setMyReports((prevReports) =>
      prevReports.filter((report) => report.id !== reportId),
    );

    // Update statistics after deletion.
    setTotalReports((prev) => Math.max(0, prev - 1));
  }, []);

  // ==========================================
  // SIDEBAR
  // ==========================================

  const sidebar = (
    <aside className="flex h-full w-[250px] shrink-0 flex-col px-6 py-7">
      {/* Logo */}
      <div className="mb-12 flex items-center gap-3 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white">
          <Recycle size={21} />
        </div>

        <span className="text-lg font-extrabold tracking-tight">
          WASTE<span className="text-emerald-500">FLOW</span>
        </span>
      </div>

      <p className="mb-4 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
        Main Menu
      </p>

      <nav className="space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = activeMenu === item.label;

          return (
            <button
              key={item.label}
              onClick={() => {
                setMobileMenuOpen(false);

                if (item.label === "Create Report") {
                  router.push("/reports/create");
                  return;
                }

                setActiveMenu(item.label);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "bg-black text-white shadow-lg shadow-black/10"
                  : "text-gray-500 hover:bg-gray-100 hover:text-black"
              }`}
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Preferences */}
      <div className="mt-auto">
        <div className="my-6 border-t border-gray-100" />

        {/* User Profile */}
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
            {user.name?.charAt(0).toUpperCase() || "U"}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-gray-900">
              {user.role === "ADMIN"
                ? `Admin ${user.name ?? ""}`
                : `User ${user.name ?? ""}`}
            </p>

            <p className="truncate text-xs text-gray-400">{user.email ?? ""}</p>
          </div>

          <button
            aria-label="Logout"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-gray-400 hover:text-red-500"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );

  // ==========================================
  // DATE FORMATTER
  // ==========================================

  const formatDate = (date: string | Date) => {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(date));
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#edf5d9] via-[#d9f7e9] to-[#d1f5e8] p-3 md:p-6 lg:p-10">
      <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-[1600px] overflow-hidden rounded-[30px] bg-white shadow-2xl shadow-emerald-900/5 lg:min-h-[calc(100vh-80px)]">
        <div className="hidden lg:block">{sidebar}</div>

        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/30 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="h-full w-[280px] bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-end p-3">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={22} />
                </button>
              </div>

              {sidebar}
            </div>
          </div>
        )}

        <section className="min-w-0 flex-1 px-5 py-6 md:px-8 md:py-8 lg:px-10 lg:py-10">
          <header className="mb-10 flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-xl border border-gray-200 p-2 lg:hidden"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>

              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-950 md:text-4xl">
                  {activeMenu === "My Reports"
                    ? "My Reports"
                    : activeMenu === "Manage Reports"
                      ? "Manage Reports"
                      : activeMenu === "Categories"
                        ? "Categories"
                        : activeMenu === "Users"
                          ? "Users"
                          : activeMenu === "Settings"
                            ? "Settings"
                            : "Waste Dashboard"}
                </h1>

                <p className="mt-1 text-sm text-gray-400 md:text-base">
                  {activeMenu === "My Reports"
                    ? "View and track your submitted waste reports."
                    : activeMenu === "Users"
                      ? "View and manage all registered users."
                      : activeMenu === "Categories"
                        ? "View and manage waste categories."
                        : `Welcome back, ${
                            user.role === "ADMIN"
                              ? `Admin ${user.name ?? ""}`
                              : (user.name ?? "")
                          }`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {user.role === "USER" && (
                <Link
                  href="/reports/create"
                  className="flex items-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-bold text-white transition hover:bg-gray-800"
                >
                  <Plus size={17} />
                  <span className="hidden sm:inline">Add Report</span>
                </Link>
              )}
            </div>
          </header>

          {activeMenu === "Manage Reports" ? (
            <AdminReportsSection
              reports={allReports}
              isLoading={isLoadingAllReports}
              error={allReportsError}
              search={search}
            />
          ) : activeMenu === "My Reports" ? (
            <>
              <div className="mb-6 flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3">
                <Search size={18} className="text-gray-400" />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your reports..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                />
              </div>

              <MyReportsSection
                reports={myReports}
                isLoading={isLoadingReports}
                error={reportError}
                search={search}
                onDeleteSuccess={handleDeleteSuccess}
              />
            </>
          ) : activeMenu === "Users" ? (
            <>
              {/* USER STATISTICS */}
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-500">
                      Total Users
                    </p>
                    <Users size={20} className="text-emerald-600" />
                  </div>
                  <h2 className="mt-2 text-3xl font-extrabold text-gray-950">
                    {isLoadingUsers ? "..." : users.length}
                  </h2>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-500">
                      Active Users
                    </p>
                    <CheckCircle2 size={20} className="text-emerald-600" />
                  </div>
                  <h2 className="mt-2 text-3xl font-extrabold text-gray-950">
                    {isLoadingUsers
                      ? "..."
                      : users.filter((u) => u.isActive).length}
                  </h2>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-500">
                      Administrators
                    </p>
                    <Settings size={20} className="text-amber-600" />
                  </div>
                  <h2 className="mt-2 text-3xl font-extrabold text-gray-950">
                    {isLoadingUsers
                      ? "..."
                      : users.filter((u) => u.role === "ADMIN").length}
                  </h2>
                </div>
              </div>

              {/* USER TABLE */}
              <div className="overflow-hidden rounded-[26px] border border-gray-100 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5">
                  <div>
                    <h2 className="text-lg font-extrabold text-gray-950">
                      Registered Users
                    </h2>
                    <p className="mt-1 text-sm text-gray-400">
                      Complete list of registered users.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveMenu("Users")}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2">
                      <Users size={16} />
                      {users.length} Users
                    </span>
                  </button>
                </div>

                {isLoadingUsers ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <LoaderCircle
                      size={30}
                      className="animate-spin text-emerald-600"
                    />
                    <p className="text-sm text-gray-400">
                      Loading user data...
                    </p>
                  </div>
                ) : userError ? (
                  <div className="p-10 text-center">
                    <p className="font-semibold text-rose-600">{userError}</p>
                    <button
                      type="button"
                      onClick={() => setActiveMenu("Dashboard")}
                      className="mt-4 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
                    >
                      Back to Dashboard
                    </button>
                  </div>
                ) : users.length === 0 ? (
                  <div className="py-16 text-center">
                    <Users size={35} className="mx-auto text-gray-300" />
                    <p className="mt-3 font-semibold text-gray-700">
                      No users found
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                      There are no registered users yet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[750px] text-left">
                      <thead className="bg-gray-50">
                        <tr className="text-xs font-bold uppercase tracking-wider text-gray-400">
                          <th className="px-6 py-4">User</th>
                          <th className="px-6 py-4">Email</th>
                          <th className="px-6 py-4">Role</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Registered At</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-100">
                        {users.map((item) => (
                          <tr
                            key={item.id}
                            className="transition hover:bg-gray-50"
                          >
                            {/* USER */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                                  {item.name?.charAt(0).toUpperCase() || "U"}
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-gray-900">
                                    {item.name || "Unnamed User"}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    ID: {item.id.slice(0, 8)}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* EMAIL */}
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-600">
                                {item.email}
                              </span>
                            </td>

                            {/* ROLE */}
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                                  item.role === "ADMIN"
                                    ? "bg-purple-50 text-purple-700"
                                    : "bg-blue-50 text-blue-700"
                                }`}
                              >
                                {item.role}
                              </span>
                            </td>

                            {/* STATUS */}
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                                  item.isActive
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-rose-50 text-rose-600"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    item.isActive
                                      ? "bg-emerald-500"
                                      : "bg-rose-500"
                                  }`}
                                />
                                {item.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>

                            {/* REGISTERED DATE */}
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-500">
                                {formatDate(item.createdAt)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : activeMenu === "Categories" ? (
            <>
              {/* CATEGORY STATISTICS */}
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-500">
                      Total Categories
                    </p>
                    <Recycle size={20} className="text-emerald-600" />
                  </div>

                  <h2 className="mt-2 text-3xl font-extrabold text-gray-950">
                    {isLoadingCategories ? "..." : categories.length}
                  </h2>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-500">
                      Category Management
                    </p>
                    <Settings size={20} className="text-amber-600" />
                  </div>

                  <p className="mt-2 text-sm text-gray-500">
                    Manage waste categories registered in the system.
                  </p>
                </div>
              </div>

              {/* CATEGORY TABLE */}
              <div className="overflow-hidden rounded-[26px] border border-gray-100 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5">
                  <div>
                    <h2 className="text-lg font-extrabold text-gray-950">
                      Waste Categories
                    </h2>
                    <p className="mt-1 text-sm text-gray-400">
                      Complete list of available waste categories.
                    </p>
                  </div>

                  <span className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600">
                    {categories.length} Categories
                  </span>
                </div>

                {isLoadingCategories ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <LoaderCircle
                      size={30}
                      className="animate-spin text-emerald-600"
                    />
                    <p className="text-sm text-gray-400">
                      Loading category data...
                    </p>
                  </div>
                ) : categoryError ? (
                  <div className="p-10 text-center">
                    <p className="font-semibold text-rose-600">
                      {categoryError}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveMenu("Dashboard")}
                      className="mt-4 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
                    >
                      Back to Dashboard
                    </button>
                  </div>
                ) : categories.length === 0 ? (
                  <div className="py-16 text-center">
                    <Recycle size={35} className="mx-auto text-gray-300" />
                    <p className="mt-3 font-semibold text-gray-700">
                      No categories found
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                      There are no waste categories registered yet.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-left">
                      <thead className="bg-gray-50">
                        <tr className="text-xs font-bold uppercase tracking-wider text-gray-400">
                          <th className="px-6 py-4">Category</th>
                          <th className="px-6 py-4">Description</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-100">
                        {categories.map((category) => (
                          <tr
                            key={category.id}
                            className="transition hover:bg-gray-50"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                                  <Recycle size={19} />
                                </div>

                                <div>
                                  <p className="text-sm font-bold text-gray-900">
                                    {category.name}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    ID: {category.id.slice(0, 8)}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-6 py-4">
                              <p className="max-w-md text-sm text-gray-500">
                                {category.description ||
                                  "No description provided."}
                              </p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : activeMenu === "Dashboard" ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="relative overflow-hidden rounded-[22px] bg-[#fff1d6] p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Reports</p>
                      <h2 className="mt-1 text-3xl font-extrabold text-gray-950">
                        {isLoadingStats ? (
                          <LoaderCircle className="animate-spin" size={25} />
                        ) : (
                          totalReports
                        )}
                      </h2>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                      <FileText size={20} />
                    </div>
                  </div>

                  <div className="mt-7 flex h-12 items-end gap-2">
                    {[20, 34, 25, 47, 32, 52, 39, 45].map((height, i) => (
                      <div
                        key={i}
                        style={{ height: `${height}px` }}
                        className={`w-4 rounded-t-md ${i % 2 === 0 ? "bg-black" : "bg-amber-400"}`}
                      />
                    ))}

                    <div className="ml-auto flex items-center gap-1 text-xs font-bold">
                      <TrendingUp size={14} />
                      18.5%
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-gray-500">
                    Compared to last month
                  </p>
                </div>

                <div className="relative overflow-hidden rounded-[22px] bg-[#ffebe6] p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Pending Reports</p>
                      <h2 className="mt-1 text-3xl font-extrabold text-gray-950">
                        {isLoadingStats ? (
                          <LoaderCircle className="animate-spin" size={25} />
                        ) : (
                          totalPendingReports
                        )}
                      </h2>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                      <Clock size={20} />
                    </div>
                  </div>

                  <div className="mt-7 flex h-12 items-end gap-2">
                    {[45, 30, 24, 39, 47, 32, 54, 40].map((height, i) => (
                      <div
                        key={i}
                        style={{ height: `${height}px` }}
                        className={`w-4 rounded-t-md ${i % 2 === 0 ? "bg-black" : "bg-rose-400"}`}
                      />
                    ))}

                    <div className="ml-auto flex items-center gap-1 text-xs font-bold">
                      <TrendingUp size={14} />
                      8.2%
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-gray-500">
                    Reports waiting for action
                  </p>
                </div>

                <div className="relative overflow-hidden rounded-[22px] bg-[#eff9e7] p-6">
                  <p className="text-sm text-gray-500">Completed Reports</p>

                  <h2 className="mt-1 text-3xl font-extrabold text-gray-950">
                    {isLoadingStats ? (
                      <LoaderCircle className="animate-spin" size={25} />
                    ) : (
                      totalCompletedReports
                    )}
                  </h2>

                  <div className="mt-5 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white">
                      <CheckCircle2 size={23} className="text-emerald-600" />
                    </div>

                    <div>
                      <p className="text-xl font-extrabold">
                        {totalReports > 0
                          ? `${((totalCompletedReports / totalReports) * 100).toFixed(1)}%`
                          : "0%"}
                      </p>

                      <p className="text-xs text-gray-500">Completion rate</p>
                    </div>
                  </div>

                  <div className="absolute -right-7 -top-8 h-40 w-40 rounded-full border border-emerald-300" />
                  <div className="absolute -right-1 top-9 h-24 w-24 rounded-full border border-emerald-400" />
                </div>
              </div>

              <div className="mt-10 grid gap-5 xl:grid-cols-[1.6fr_0.9fr]">
                <div className="rounded-[26px] border border-gray-100 bg-gray-50 p-5">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-extrabold text-gray-950">
                        Report Overview
                      </h2>
                      <p className="mt-1 text-sm text-gray-400">
                        Waste reports around your area
                      </p>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
                      <label
                        htmlFor="distance"
                        className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400"
                      >
                        Radius
                      </label>
                      <input
                        id="distance"
                        type="range"
                        min={1}
                        max={15}
                        value={distance}
                        onChange={(e) => setDistance(Number(e.target.value))}
                        className="w-24 accent-emerald-600"
                      />
                      <span className="text-sm font-bold text-gray-700">
                        {distance} km
                      </span>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5">
                    <div className="relative h-[260px] overflow-hidden rounded-[20px] border border-emerald-100 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.15),_rgba(255,255,255,0)_60%)]">
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:32px_32px]" />

                      {[
                        { x: "24%", y: "26%", level: "High" },
                        { x: "52%", y: "45%", level: "Medium" },
                        { x: "76%", y: "32%", level: "Low" },
                        { x: "64%", y: "68%", level: "High" },
                      ].map((point, index) => (
                        <div
                          key={index}
                          className="absolute -translate-x-1/2 -translate-y-1/2"
                          style={{ left: point.x, top: point.y }}
                        >
                          <div className="flex items-center gap-2 rounded-full border border-white bg-white/90 px-2.5 py-1.5 shadow-sm shadow-emerald-900/5">
                            <MapPin
                              size={14}
                              className={
                                point.level === "High"
                                  ? "text-rose-500"
                                  : point.level === "Medium"
                                    ? "text-amber-500"
                                    : "text-emerald-500"
                              }
                            />
                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">
                              {point.level}
                            </span>
                          </div>
                        </div>
                      ))}

                      <div className="absolute bottom-4 left-4 rounded-full bg-black px-3 py-2 text-xs font-bold text-white shadow-lg shadow-black/10">
                        {distance} km coverage
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-extrabold text-gray-900">
                        Priority Areas
                      </h3>
                      <ArrowUpRight size={18} className="text-emerald-600" />
                    </div>

                    <div className="space-y-3">
                      {[
                        {
                          label: "Downtown Market",
                          value: "32 reports",
                          tone: "bg-rose-50 text-rose-600",
                        },
                        {
                          label: "North Industrial Zone",
                          value: "18 reports",
                          tone: "bg-amber-50 text-amber-700",
                        },
                        {
                          label: "Riverside District",
                          value: "11 reports",
                          tone: "bg-emerald-50 text-emerald-700",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${item.tone}`}
                            >
                              {item.label.charAt(0)}
                            </span>
                            <p className="text-sm font-semibold text-gray-700">
                              {item.label}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-gray-500">
                            {item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[26px] border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-extrabold text-gray-900">
                        Quick Actions
                      </h3>
                      <Trash2 size={18} className="text-gray-400" />
                    </div>

                    <div className="space-y-3 text-sm text-gray-600">
                      <button
                        type="button"
                        onClick={() => setActiveMenu("Manage Reports")}
                        className="flex w-full items-center justify-between rounded-2xl border border-gray-200 px-3 py-2.5 text-left hover:bg-gray-50"
                      >
                        <span>Review incoming reports</span>
                        <ArrowUpRight size={15} className="text-gray-400" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveMenu("My Reports")}
                        className="flex w-full items-center justify-between rounded-2xl border border-gray-200 px-3 py-2.5 text-left hover:bg-gray-50"
                      >
                        <span>Track my submissions</span>
                        <ArrowUpRight size={15} className="text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-[26px] border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <h2 className="text-2xl font-extrabold text-gray-900">
                {activeMenu}
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                This section is ready for the next content update.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
