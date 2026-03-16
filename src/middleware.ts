import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/_next/",
  "/favicon",
  "/api/webhooks/stripe",
  "/dulos-logo.svg",
];

const ALLOWED_EMAILS = ["angel.lopez@vulkn-ai.com"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Allow public paths and static files
  if (PUBLIC_PATHS.some((p) => path.startsWith(p)) || path.includes(".")) {
    return NextResponse.next();
  }

  // Create mutable response to pass cookies through
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update cookies on both request (for downstream) and response (for browser)
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // IMPORTANT: Use getUser() not getSession() for security
  // getUser() validates the JWT against Supabase, getSession() only reads from cookie
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user?.email) {
    // No valid session - redirect to login
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  if (!ALLOWED_EMAILS.includes(user.email.toLowerCase())) {
    // Valid session but not authorized - redirect with error
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(url);
  }

  // User is authenticated and authorized
  response.headers.set("X-Dulos-Security", "v7");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon).*)"],
};
