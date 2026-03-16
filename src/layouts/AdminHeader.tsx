"use client";
import { useState } from "react";
import Image from "next/image";

interface AdminHeaderProps {
  user: { name: string; email: string; role: string };
  onLogout: () => void;
}

export default function AdminHeader({ user, onLogout }: AdminHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-8 h-24 flex items-center justify-center relative">
        {/* Centered Logo + Brand Name (Cellosa-style) */}
        <div className="flex items-center gap-4">
          <Image src="/dulos-logo.svg" alt="Dulos" width={56} height={56} className="h-14 w-14" priority />
          <span className="text-2xl font-bold tracking-tight text-[#E63946]">DULOS ADMIN</span>
        </div>

        {/* Right side: Salir button (Cellosa-style) */}
        <div className="absolute right-8 flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition"
            >
              <span className="text-sm hidden md:block">{user.name}</span>
              <div className="w-8 h-8 rounded-full bg-[#E63946] flex items-center justify-center text-white text-sm font-semibold">
                {user.name.charAt(0)}
              </div>
            </button>

            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                    <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium bg-[#E63946]/10 text-[#E63946] rounded">{user.role}</span>
                  </div>
                  <button onClick={onLogout} className="w-full text-left px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-[#E63946] transition flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Salir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
