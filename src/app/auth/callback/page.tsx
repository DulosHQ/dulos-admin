"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Suspense } from "react";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    async function handleCallback() {
      if (code) {
        // PKCE flow: exchange code for session
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error || !data?.user?.email) {
          router.replace("/login?error=auth_failed");
          return;
        }

        if (data.user.email.toLowerCase() !== "angel.lopez@vulkn-ai.com") {
          await supabase.auth.signOut();
          router.replace("/login?error=acceso_denegado");
          return;
        }

        router.replace("/");
        return;
      }

      // No code - check existing session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        if (session.user.email.toLowerCase() !== "angel.lopez@vulkn-ai.com") {
          await supabase.auth.signOut();
          router.replace("/login?error=acceso_denegado");
        } else {
          router.replace("/");
        }
      } else {
        router.replace("/login");
      }
    }

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="animate-pulse text-gray-500 text-sm">Iniciando sesión...</div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-pulse text-gray-500 text-sm">Cargando...</div>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
