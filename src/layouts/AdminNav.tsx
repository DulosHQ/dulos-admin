"use client";

import { useState } from "react";

interface Tab {
  id: string;
  label: string;
  permissions: string[];
  secondary?: boolean;
}

const TABS: Tab[] = [
  { id: "resumen", label: "Vista General", permissions: ["finance.read", "finance.stats.global"] },
  { id: "finanzas", label: "Finanzas", permissions: ["finance.read", "inventory.read", "access.stats"] },
  { id: "liquidaciones", label: "Liquidaciones", permissions: ["finance.read", "finance.manage"] },
  { id: "ads", label: "Ads", permissions: ["finance.read", "finance.stats.global"] },
  { id: "eventos", label: "Eventos", permissions: ["project.read", "project.manage", "event.read"] },
  { id: "venues", label: "Venues", permissions: ["project.manage", "sys.config"] },
  { id: "operaciones", label: "Operaciones", permissions: ["ticket.scan", "marketing.codes.manage"], secondary: true },
  { id: "crons", label: "🔄 Crons", permissions: ["sys.config", "sys.audit"], secondary: true },
  { id: "admin", label: "Configuración", permissions: ["team.manage", "sys.config", "sys.audit"], secondary: true },
];

interface AdminNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  permissions: string[];
}

export default function AdminNav({ activeTab, onTabChange, permissions }: AdminNavProps) {
  const [showMore, setShowMore] = useState(false);
  const visibleTabs = TABS.filter(tab =>
    tab.permissions.some(p => permissions.includes(p))
  );

  const primaryTabs = visibleTabs.filter(t => !t.secondary);
  const secondaryTabs = visibleTabs.filter(t => t.secondary);
  const isSecondaryActive = secondaryTabs.some(t => t.id === activeTab);

  return (
    <nav className="bg-[#111] relative">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-8">
        <div className="flex gap-4 sm:gap-8 overflow-x-auto scrollbar-hide justify-start sm:justify-center py-1 items-center">
          {primaryTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { onTabChange(tab.id); setShowMore(false); }}
              className={`relative px-2 py-4 text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "text-[#EF4444]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#EF4444]" />
              )}
            </button>
          ))}

          {/* Secondary tabs — "Más" button (dropdown renders outside overflow container) */}
          {secondaryTabs.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowMore(!showMore); }}
              className={`relative px-2 py-4 text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                isSecondaryActive ? "text-[#EF4444]" : "text-gray-400 hover:text-white"
              }`}
            >
              {isSecondaryActive ? secondaryTabs.find(t => t.id === activeTab)?.label : "Más"} ▾
              {isSecondaryActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#EF4444]" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Dropdown rendered OUTSIDE the overflow-x-auto container */}
      {showMore && secondaryTabs.length > 0 && (
        <>
          {/* Backdrop to close dropdown */}
          <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)} />
          <div className="absolute right-3 sm:right-8 top-full mt-1 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl z-50 min-w-[160px]">
            {secondaryTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { onTabChange(tab.id); setShowMore(false); }}
                className={`block w-full text-left px-4 py-3 text-sm transition-colors ${
                  activeTab === tab.id
                    ? "text-[#EF4444] bg-[#111]"
                    : "text-gray-300 hover:bg-[#222] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </>
      )}
    </nav>
  );
}
