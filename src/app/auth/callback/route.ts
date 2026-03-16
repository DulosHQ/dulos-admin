import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const cookieStore = await cookies();
  const response = NextResponse.redirect(`${origin}/`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Write cookies to BOTH the request store AND the response
            cookieStore.set(name, value, options);
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

  // SECURITY: Only angel.lopez@vulkn-ai.com
  const userEmail = data.user.email.toLowerCase();
  if (userEmail !== "angel.lopez@vulkn-ai.com") {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=acceso_denegado`);
  }

  // Return response WITH cookies already set
  return response;
}
