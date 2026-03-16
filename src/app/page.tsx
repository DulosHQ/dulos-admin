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

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("resumen");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage first
    const stored = localStorage.getItem("dulos_user");
    if (stored) {
      setUser(JSON.parse(stored));
      setLoading(false);
      return;
    }

    // Check Supabase session (for Google OAuth returns)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const userData = {
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Usuario",
          role: "ADMIN",
          permissions: DEFAULT_PERMS,
        };
        localStorage.setItem("dulos_user", JSON.stringify(userData));
        setUser(userData);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user && !user) {
        const userData = {
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Usuario",
          role: "ADMIN",
          permissions: DEFAULT_PERMS,
        };
        localStorage.setItem("dulos_user", JSON.stringify(userData));
        setUser(userData);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={(u: any) => { localStorage.setItem("dulos_user", JSON.stringify(u)); setUser(u); }} />;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("dulos_user");
    setUser(null);
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
