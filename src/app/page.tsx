"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import SummaryPage from "@/pages/SummaryPage";
import FinancePage from "@/pages/FinancePage";
import EventsPage from "@/pages/EventsPage";
import OpsPage from "@/pages/OpsPage";
import AdminPage from "@/pages/AdminPage";
import AdminShell from "@/layouts/AdminShell";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "pkce",
      },
    }
  );
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ["finance.read","finance.stats.global","event.read","event.write","project.read","project.manage","inventory.read","ticket.scan","marketing.codes.manage","team.manage","sys.config","sys.audit","access.stats"],
  OPERADOR: ["finance.read","event.read","event.write","inventory.read","ticket.scan","marketing.codes.manage","project.read","project.manage","access.stats"],
  PRODUCTOR: ["finance.read","event.read","project.read","inventory.read"],
  TAQUILLERO: ["ticket.scan","ticket.checkin","inventory.read"],
  SOPORTE: ["event.read","ticket.read","order.view.list"],
};

async function validateTeamMember(email: string): Promise<{ valid: boolean; user: any; error?: string }> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/dulos_team?email=eq.${encodeURIComponent(email)}&select=*`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      }
    );
    const team = await res.json();

    if (!team || team.length === 0) {
      return { valid: false, user: null, error: "No tienes acceso al sistema. Contacta al administrador." };
    }

    const member = team[0];

    if (!member.is_active) {
      return { valid: false, user: null, error: "Tu cuenta ha sido desactivada." };
    }

    return {
      valid: true,
      user: {
        email: member.email,
        name: member.name,
        role: member.role,
        permissions: ROLE_PERMISSIONS[member.role] || [],
      },
    };
  } catch {
    return { valid: false, user: null, error: "Error de conexión. Intenta de nuevo." };
  }
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("resumen");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const secVersion = localStorage.getItem("dulos_sec_v");
      // Force re-auth if security version changed
      if (secVersion !== "v4") {
        localStorage.removeItem("dulos_user");
        localStorage.removeItem("dulos_sec_v");
      }

      // SECURITY: Always verify Supabase session FIRST — never trust localStorage alone
      const { data: { session } } = await getSupabase().auth.getSession();

      if (!session?.user?.email) {
        // No valid Supabase session — redirect to login
        localStorage.removeItem("dulos_user");
        localStorage.removeItem("dulos_sec_v");
        if (mounted) router.push("/login");
        return;
      }

      // Valid Supabase session — now validate against dulos_team
      const result = await validateTeamMember(session.user.email);
      if (result.valid) {
        localStorage.setItem("dulos_user", JSON.stringify(result.user));
        localStorage.setItem("dulos_sec_v", "v4");
        if (mounted) { setUser(result.user); setLoading(false); }
      } else {
        // NOT authorized — sign out and redirect to login
        await getSupabase().auth.signOut();
        localStorage.removeItem("dulos_user");
        localStorage.removeItem("dulos_sec_v");
        if (mounted) router.push("/login");
      }
    };

    init();
    return () => { mounted = false; };
  }, [router]);

  const handleLogout = async () => {
    await getSupabase().auth.signOut();
    localStorage.removeItem("dulos_user");
    localStorage.removeItem("dulos_sec_v");
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Verificando acceso...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Redirigiendo...</div>
      </div>
    );
  }

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
