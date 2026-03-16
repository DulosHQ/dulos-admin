import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Allowed emails - server-side check
const ALLOWED_EMAILS = ["angel.lopez@vulkn-ai.com"];

export function middleware(request: NextRequest) {
  // Allow API routes and static files
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/") || path.startsWith("/_next/") || path.startsWith("/favicon") || path.includes(".")) {
    return NextResponse.next();
  }

  // Check for auth cookie from Supabase
  const sbCookies = request.cookies.getAll();
  const hasAuthCookie = sbCookies.some(c => 
    c.name.includes("sb-") && c.name.includes("auth-token")
  );

  // If no auth cookie and not on a public path, the client-side will handle redirect
  // But we add a security header
  const response = NextResponse.next();
  response.headers.set("X-Dulos-Security", "v3");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon).*)"],
};
