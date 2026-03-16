"use client";
import AdminHeader from "./AdminHeader";
import AdminNav from "./AdminNav";

interface AdminShellProps {
  children: React.ReactNode;
  user: { name: string; email: string; role: string; permissions: string[] };
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

export default function AdminShell({ children, user, activeTab, onTabChange, onLogout }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <AdminHeader user={user} onLogout={onLogout} />
      <AdminNav activeTab={activeTab} onTabChange={onTabChange} permissions={user.permissions} />
      <main className="max-w-[1400px] mx-auto px-8 py-8">
        {children}
      </main>
    </div>
  );
}
