"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import SummaryPage from "@/pages/SummaryPage";
import FinancePage from "@/pages/FinancePage";
import EventsPage from "@/pages/EventsPage";
import OpsPage from "@/pages/OpsPage";
import AdminPage from "@/pages/AdminPage";
import AdminShell from "@/layouts/AdminShell";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
      // Middleware already verified auth — just get the session
      const { data: { session } } = await getSupabase().auth.getSession();

      if (!session?.user?.email) {
        if (mounted) router.push("/login");
        return;
      }

      const email = session.user.email.toLowerCase();
      // Set user from session directly — middleware already validated dulos_team
      const userObj = {
        email,
        name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || email.split("@")[0],
        role: "ADMIN",
        permissions: ROLE_PERMISSIONS["ADMIN"] || [],
      };

      if (mounted) { setUser(userObj); setLoading(false); }
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
