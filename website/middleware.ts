import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";

const ProtectedRoutes = ["/dashboard", "/reports"];

export async function middleware(request: NextRequest) {
  const session = await auth();

  const isLoggedIn = !!session?.user;
  const { pathname } = request.nextUrl;

  const isProtectedRoute = ProtectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // User belum login
  if (!isLoggedIn && isProtectedRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // User sudah login dan mengakses halaman login
  if (isLoggedIn && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
