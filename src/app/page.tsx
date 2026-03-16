"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import LoginPage from "@/pages/LoginPage";
import SummaryPage from "@/pages/SummaryPage";
import FinancePage from "@/pages/FinancePage";
import EventsPage from "@/pages/EventsPage";
import OpsPage from "@/pages/OpsPage";
import AdminPage from "@/pages/AdminPage";
import AdminShell from "@/layouts/AdminShell";

const supabase = createClient(
  "https://udjwabtyhjcrpyuffavz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTM5MzQsImV4cCI6MjA4OTE2OTkzNH0.5RxuCjEPKY2eLmSG8iwMVKJnczcBRNhQH1QADm68UW4"
);

const DEFAULT_PERMS = ["finance.read","finance.stats.global","event.read","project.read","project.manage","inventory.read","ticket.scan","marketing.codes.manage","team.manage","sys.config","sys.audit","access.stats"];

async function validateUser(email: string, name: string): Promise<{valid: boolean; user: any; error?: string}> {
  try {
    const res = await fetch(
      `https://udjwabtyhjcrpyuffavz.supabase.co/rest/v1/dulos_team?email=eq.${encodeURIComponent(email)}&is_active=eq.true&select=*`,
      {
        headers: {
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTM5MzQsImV4cCI6MjA4OTE2OTkzNH0.5RxuCjEPKY2eLmSG8iwMVKJnczcBRNhQH1QADm68UW4",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1OTM5MzQsImV4cCI6MjA4OTE2OTkzNH0.5RxuCjEPKY2eLmSG8iwMVKJnczcBRNhQH1QADm68UW4",
        },
      }
    );
    const team = await res.json();
    
    if (team && team.length > 0) {
      return {
        valid: true,
        user: {
          email: team[0].email,
          name: team[0].name,
          role: team[0].role,
          permissions: DEFAULT_PERMS,
        },
      };
    }
    return { valid: false, user: null, error: "No tienes acceso. Contacta al administrador." };
  } catch {
    return { valid: false, user: null, error: "Error verificando acceso." };
  }
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("resumen");
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // 1. Check localStorage
      const stored = localStorage.getItem("dulos_user");
      if (stored) {
        if (mounted) { setUser(JSON.parse(stored)); setLoading(false); }
        return;
      }

      // 2. Check Supabase session (Google OAuth return)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const result = await validateUser(
          session.user.email,
          session.user.user_metadata?.full_name || session.user.email.split("@")[0]
        );
        if (result.valid) {
          localStorage.setItem("dulos_user", JSON.stringify(result.user));
          if (mounted) { setUser(result.user); setLoading(false); }
        } else {
          await supabase.auth.signOut();
          if (mounted) { setAuthError(result.error || "Acceso denegado"); setLoading(false); }
        }
        return;
      }

      if (mounted) setLoading(false);
    };

    init();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Verificando acceso...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        onLogin={async (u: any) => {
          // Validate against dulos_team
          const result = await validateUser(u.email, u.name);
          if (result.valid) {
            localStorage.setItem("dulos_user", JSON.stringify(result.user));
            setUser(result.user);
          } else {
            localStorage.setItem("dulos_user", JSON.stringify(u));
            setUser(u);
          }
        }}
        authError={authError}
      />
    );
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("dulos_user");
    setUser(null);
    setAuthError("");
  };

  const pages: Record<string, React.ReactNode> = {
    resumen: <SummaryPage />,
    finanzas: <FinancePage />,
    eventos: <EventsPage />,
    operaciones: <OpsPage />,
    admin: <AdminPage />,
  };

  return (
    <AdminShell user={user} activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout}>
      {pages[activeTab] || <SummaryPage />}
    </AdminShell>
  );
}
