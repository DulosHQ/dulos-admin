"use client";
import { useEffect, useState, useCallback } from "react";

interface CronAlert {
  cronName: string;
  issue: string;
  lastRun: string | null;
}

interface CronHealthResponse {
  status: string;
  alerts: CronAlert[];
  healthy: string[];
  unknown: string[];
  registry: string[];
  checkedAt: string;
}

interface HeartbeatRow {
  cron_name: string;
  last_run: string;
  status: string;
  records_processed: number;
  error_message: string | null;
  duration_ms: number | null;
}

const CRON_REGISTRY: Record<string, { intervalMin: number; description: string; schedule: string }> = {
  "release-seats": { intervalMin: 2, description: "Libera asientos expirados", schedule: "*/2 * * * *" },
  "guest-reminders": { intervalMin: 60, description: "Recordatorios a invitados", schedule: "0 * * * *" },
  "expire-tickets": { intervalMin: 1440, description: "Expira tickets viejos (diario)", schedule: "0 12 * * *" },
  "taquilla-corte": { intervalMin: 30, description: "Corte de taquilla automático", schedule: "*/30 * * * *" },
  "backfill-fees": { intervalMin: 60, description: "Backfill Stripe fees", schedule: "15 * * * *" },
  "daily-report": { intervalMin: 1440, description: "Reporte diario", schedule: "0 15 * * *" },
  "cleanup-pending-guests": { intervalMin: 1440, description: "Limpia guests pendientes", schedule: "0 6 * * *" },
  "reconcile-inventory": { intervalMin: 1440, description: "Reconcilia inventario", schedule: "0 7 * * *" },
  "cart-recovery": { intervalMin: 10, description: "Recuperación de carritos", schedule: "*/10 * * * *" },
  "complete-events": { intervalMin: 60, description: "Marca eventos completados", schedule: "0 * * * *" },
};

function getStatusInfo(cronName: string, alerts: CronAlert[], healthy: string[], unknown: string[]) {
  const alert = alerts.find(a => a.cronName === cronName);
  if (alert) {
    if (alert.issue.startsWith("ERROR")) return { icon: "❌", color: "text-red-400", bg: "bg-red-500/10", label: "Error" };
    if (alert.issue.startsWith("OVERDUE")) return { icon: "⚠️", color: "text-yellow-400", bg: "bg-yellow-500/10", label: "Atrasado" };
    return { icon: "❌", color: "text-red-400", bg: "bg-red-500/10", label: "Alerta" };
  }
  if (healthy.includes(cronName)) return { icon: "✅", color: "text-green-400", bg: "bg-green-500/10", label: "Sano" };
  if (unknown.includes(cronName)) return { icon: "❓", color: "text-gray-400", bg: "bg-gray-500/10", label: "Sin datos" };
  return { icon: "❓", color: "text-gray-500", bg: "bg-gray-500/10", label: "Desconocido" };
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "justo ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d ${hours % 24}h`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function CronsPage() {
  const [data, setData] = useState<CronHealthResponse | null>(null);
  const [heartbeats, setHeartbeats] = useState<Map<string, HeartbeatRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_DULOS_API_URL || "https://www.dulos.io";
  const CRON_SECRET = process.env.NEXT_PUBLIC_CRON_SECRET || "";

  const fetchHealth = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_URL}/api/cron/health?secret=${CRON_SECRET}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);

      // Also fetch heartbeat details directly from Supabase
      const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (sbUrl && sbKey) {
        const hbRes = await fetch(`${sbUrl}/rest/v1/cron_heartbeats?select=*`, {
          headers: {
            "apikey": sbKey,
            "Authorization": `Bearer ${sbKey}`,
          },
        });
        if (hbRes.ok) {
          const hbData: HeartbeatRow[] = await hbRes.json();
          const map = new Map<string, HeartbeatRow>();
          hbData.forEach(h => map.set(h.cron_name, h));
          setHeartbeats(map);
        }
      }

      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_URL, CRON_SECRET]);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const cronNames = Object.keys(CRON_REGISTRY);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            🔄 Cron Monitor
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Estado de los {cronNames.length} crons en producción
            {lastRefresh && (
              <span className="ml-2 text-gray-500">
                · Actualizado {timeAgo(lastRefresh.toISOString())}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchHealth(); }}
          disabled={loading}
          className="px-4 py-2 bg-[#1a1a1a] hover:bg-[#222] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 border border-gray-700"
        >
          <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? "Cargando..." : "Refresh"}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          ⚠️ Error al obtener estado: {error}
        </div>
      )}

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#111] rounded-lg p-4 border border-gray-800">
            <div className="text-2xl font-bold text-green-400">{data.healthy.length}</div>
            <div className="text-xs text-gray-400">✅ Sanos</div>
          </div>
          <div className="bg-[#111] rounded-lg p-4 border border-gray-800">
            <div className="text-2xl font-bold text-red-400">{data.alerts.filter(a => a.issue.startsWith("ERROR")).length}</div>
            <div className="text-xs text-gray-400">❌ Con error</div>
          </div>
          <div className="bg-[#111] rounded-lg p-4 border border-gray-800">
            <div className="text-2xl font-bold text-yellow-400">{data.alerts.filter(a => a.issue.startsWith("OVERDUE")).length}</div>
            <div className="text-xs text-gray-400">⚠️ Atrasados</div>
          </div>
          <div className="bg-[#111] rounded-lg p-4 border border-gray-800">
            <div className="text-2xl font-bold text-gray-400">{data.unknown.length}</div>
            <div className="text-xs text-gray-400">❓ Sin datos</div>
          </div>
        </div>
      )}

      {/* Cron table */}
      <div className="bg-[#111] rounded-lg border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-3">Cron</th>
                <th className="text-left px-4 py-3">Descripción</th>
                <th className="text-center px-4 py-3">Estado</th>
                <th className="text-left px-4 py-3">Última ejecución</th>
                <th className="text-right px-4 py-3">Registros</th>
                <th className="text-right px-4 py-3">Duración</th>
                <th className="text-left px-4 py-3">Schedule</th>
              </tr>
            </thead>
            <tbody>
              {cronNames.map((name) => {
                const config = CRON_REGISTRY[name];
                const hb = heartbeats.get(name);
                const statusInfo = data
                  ? getStatusInfo(name, data.alerts, data.healthy, data.unknown)
                  : { icon: "⏳", color: "text-gray-500", bg: "bg-gray-500/10", label: "..." };
                const alert = data?.alerts.find(a => a.cronName === name);

                return (
                  <tr key={name} className="border-b border-gray-800/50 hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-4 py-3">
                      <code className="text-white font-mono text-xs bg-[#1a1a1a] px-2 py-1 rounded">
                        {name}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{config.description}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                        {statusInfo.icon} {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-300 text-xs">
                        {hb ? timeAgo(hb.last_run) : (alert?.lastRun ? timeAgo(alert.lastRun) : "—")}
                      </div>
                      {hb?.last_run && (
                        <div className="text-gray-500 text-[10px]">
                          {new Date(hb.last_run).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono text-xs">
                      {hb?.records_processed ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 font-mono text-xs">
                      {formatDuration(hb?.duration_ms ?? null)}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-gray-500 text-[10px] font-mono">{config.schedule}</code>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alert details */}
      {data && data.alerts.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 space-y-2">
          <h3 className="text-red-400 font-medium text-sm">🚨 Alertas activas</h3>
          {data.alerts.map((alert, i) => (
            <div key={i} className="text-sm text-gray-300 flex items-start gap-2">
              <span className="text-red-400 font-mono">{alert.cronName}:</span>
              <span className="text-gray-400">{alert.issue}</span>
            </div>
          ))}
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="text-center text-gray-600 text-xs">
        Auto-refresh cada 30 segundos
      </div>
    </div>
  );
}
