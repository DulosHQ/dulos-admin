import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const origin = requestUrl.origin;

  if (error) {
    console.error("OAuth error:", error);
    return NextResponse.redirect(`${origin}/login?error=${error}`);
  }

  if (!code) {
    console.error("No code in callback URL");
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const cookieStore = await cookies();

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
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("Exchange error:", exchangeError.message);
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  const email = data.session?.user?.email?.toLowerCase();
  if (!email || email !== "angel.lopez@vulkn-ai.com") {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=acceso_denegado`);
  }

  return NextResponse.redirect(`${origin}/`);
}
