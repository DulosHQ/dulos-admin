import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (!code) {
    // No code = might be hash fragment flow, let client page.tsx handle it
    // Redirect to login where onAuthStateChange will pick it up
    return NextResponse.redirect(`${origin}/login`);
  }

  // Create redirect response FIRST so we can set cookies on it
  const response = NextResponse.redirect(`${origin}/`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Read from the incoming request
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write directly to the redirect response
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data?.user?.email) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // HARDLOCK: solo angel.lopez@vulkn-ai.com
  if (data.user.email.toLowerCase() !== "angel.lopez@vulkn-ai.com") {
    return NextResponse.redirect(`${origin}/login?error=acceso_denegado`);
  }

  // Return redirect response WITH session cookies attached
  return response;
}
