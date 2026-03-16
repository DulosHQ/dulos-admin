"use client";

interface Tab {
  id: string;
  label: string;
  permissions: string[];
}

const TABS: Tab[] = [
  { id: "resumen", label: "Vista General", permissions: ["finance.read", "finance.stats.global"] },
  { id: "finanzas", label: "Finanzas", permissions: ["finance.read", "inventory.read", "access.stats"] },
  { id: "eventos", label: "Eventos", permissions: ["project.read", "project.manage", "event.read"] },
  { id: "operaciones", label: "Operaciones", permissions: ["ticket.scan", "marketing.codes.manage"] },
  { id: "admin", label: "Configuración", permissions: ["team.manage", "sys.config", "sys.audit"] },
];

interface AdminNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  permissions: string[];
}

export default function AdminNav({ activeTab, onTabChange, permissions }: AdminNavProps) {
  const visibleTabs = TABS.filter(tab =>
    tab.permissions.some(p => permissions.includes(p))
  );

  return (
    <nav className="bg-white">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="flex gap-8 overflow-x-auto scrollbar-hide justify-center py-1">
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative px-2 py-4 text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "text-[#E63946]"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab.label}
              {/* Active underline indicator (Cellosa-style) */}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E63946]" />
              )}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
