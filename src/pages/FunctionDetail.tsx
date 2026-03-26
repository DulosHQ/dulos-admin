'use client';

import React, { useState, useEffect } from 'react';
import {
  fetchScheduleInventory,
  fetchOrdersBySchedule,
  fetchEventCommissions,
  fetchZones,
  TicketZone,
  Order,
  ScheduleInventory,
  EventCommission,
} from '../lib/supabase';

/* ─── Types ─── */
interface FunctionDetailProps {
  scheduleId: string;
  eventId: string;
  eventName: string;
  venueName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  totalSold: number;
  totalCapacity: number;
}

interface ZoneDetail {
  zone_name: string;
  zone_type: string;
  capacity: number;
  sold: number;
  available: number;
  price: number;
  revenue: number;
}

interface CouponSummary {
  code: string;
  uses: number;
  totalDiscount: number;
}

interface ChannelSummary {
  channel: string;
  orders: number;
  revenue: number;
}

/* ─── Helpers ─── */
const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n);
const fmtDate = (d: string) => {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return '—'; }
};
const fmtTime = (t: string) => (t ? t.slice(0, 5) : '');

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-700"
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

/* ─── Component ─── */
export default function FunctionDetail({
  scheduleId,
  eventId,
  eventName,
  venueName,
  date,
  startTime,
  endTime,
  status,
  totalSold,
  totalCapacity,
}: FunctionDetailProps) {
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<ZoneDetail[]>([]);
  const [coupons, setCoupons] = useState<CouponSummary[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [grossRevenue, setGrossRevenue] = useState(0);
  const [totalDiscounts, setTotalDiscounts] = useState(0);
  const [commissionRate, setCommissionRate] = useState(0.15);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        const [inventory, orders, eventZones, commissions] = await Promise.all([
          fetchScheduleInventory(scheduleId),
          fetchOrdersBySchedule(scheduleId),
          fetchZones(eventId),
          fetchEventCommissions(),
        ]);

        if (cancelled) return;

        // Commission rate
        const ec = commissions.find((c: EventCommission) => c.event_id === eventId);
        setCommissionRate(ec ? ec.commission_rate : 0.15);

        // Completed orders only
        const completed = orders.filter(
          (o: Order) => o.payment_status === 'completed' || o.payment_status === 'paid'
        );

        // Gross revenue & discounts
        const gross = completed.reduce((s: number, o: Order) => s + (o.total_price || 0), 0);
        const disc = completed.reduce((s: number, o: Order) => s + (o.discount_amount || 0), 0);
        setGrossRevenue(gross);
        setTotalDiscounts(disc);

        // ── Zone Breakdown ──
        const zoneMap = new Map<string, TicketZone & { id?: string }>();
        eventZones.forEach((z: TicketZone & { id?: string }) => {
          if (z.id) zoneMap.set(z.id, z);
        });

        const zoneDetails: ZoneDetail[] = [];

        if (inventory.length > 0) {
          // Use schedule_inventory for per-function data
          inventory.forEach((si: ScheduleInventory) => {
            const tz = zoneMap.get(si.zone_id);
            const cap = si.total_capacity || si.sold + si.available || 0;
            const sold = si.sold || 0;
            const avail = si.available || 0;
            const price = tz?.price || 0;
            // Revenue from orders for this zone
            const zoneRev = completed
              .filter((o: Order) => o.zone_name === (tz?.zone_name || ''))
              .reduce((s: number, o: Order) => s + (o.total_price || 0), 0);
            zoneDetails.push({
              zone_name: tz?.zone_name || 'Zona',
              zone_type: tz?.zone_type || 'general',
              capacity: cap,
              sold,
              available: avail,
              price,
              revenue: zoneRev || sold * price,
            });
          });
        } else {
          // Fall back to orders grouped by zone_name
          const zoneSales = new Map<string, { sold: number; revenue: number }>();
          completed.forEach((o: Order) => {
            const key = o.zone_name || 'General';
            const cur = zoneSales.get(key) || { sold: 0, revenue: 0 };
            cur.sold += o.quantity || 0;
            cur.revenue += o.total_price || 0;
            zoneSales.set(key, cur);
          });

          eventZones.forEach((tz: TicketZone) => {
            const cap = (tz.available || 0) + (tz.sold || 0);
            const sales = zoneSales.get(tz.zone_name);
            zoneDetails.push({
              zone_name: tz.zone_name,
              zone_type: tz.zone_type || 'general',
              capacity: cap,
              sold: sales?.sold || tz.sold || 0,
              available: tz.available || 0,
              price: tz.price || 0,
              revenue: sales?.revenue || (tz.sold || 0) * (tz.price || 0),
            });
          });
        }
        setZones(zoneDetails);

        // ── Coupons ──
        const couponMap = new Map<string, { uses: number; discount: number }>();
        completed.forEach((o: Order) => {
          if (o.coupon_code && o.coupon_code !== '2X1_AUTO') {
            const cur = couponMap.get(o.coupon_code) || { uses: 0, discount: 0 };
            cur.uses += 1;
            cur.discount += o.discount_amount || 0;
            couponMap.set(o.coupon_code, cur);
          }
        });
        setCoupons(
          Array.from(couponMap.entries())
            .map(([code, data]) => ({ code, uses: data.uses, totalDiscount: data.discount }))
            .sort((a, b) => b.uses - a.uses)
        );

        // ── Channels ──
        const channelMap = new Map<string, { orders: number; revenue: number }>();
        completed.forEach((o: Order) => {
          const ch = o.utm_source || 'Directo';
          const cur = channelMap.get(ch) || { orders: 0, revenue: 0 };
          cur.orders += 1;
          cur.revenue += o.total_price || 0;
          channelMap.set(ch, cur);
        });
        setChannels(
          Array.from(channelMap.entries())
            .map(([channel, data]) => ({ channel, orders: data.orders, revenue: data.revenue }))
            .sort((a, b) => b.revenue - a.revenue)
        );
      } catch (err) {
        console.error('FunctionDetail load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [scheduleId, eventId]);

  const occupancyPct = totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0;
  const netSales = grossRevenue - totalDiscounts;
  const commission = netSales * commissionRate;
  const estimatedPayout = netSales - commission;

  if (loading) {
    return (
      <div className="border-t border-gray-800 px-4 py-6 animate-pulse space-y-3">
        <div className="h-4 bg-gray-800 rounded w-1/3" />
        <div className="h-3 bg-gray-800 rounded w-1/2" />
        <div className="h-20 bg-gray-800 rounded" />
        <div className="h-3 bg-gray-800 rounded w-1/4" />
      </div>
    );
  }

  return (
    <div className="border-t border-gray-800 px-4 py-4 space-y-5 animate-fade-in">
      {/* ─── 1. Overview ─── */}
      <div className="bg-[#1a1a1a] rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div>
            <h3 className="text-base font-bold text-white">{eventName}</h3>
            <p className="text-sm text-gray-400">
              {venueName} · {fmtDate(date)} · {fmtTime(startTime)}
              {endTime ? ` — ${fmtTime(endTime)}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                status === 'active'
                  ? 'bg-green-900/50 text-green-400'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              {status === 'active' ? 'Activo' : 'Cerrado'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <ProgressBar pct={occupancyPct} />
            <p className="text-xs text-gray-500 mt-1.5">
              {totalSold.toLocaleString()} / {totalCapacity.toLocaleString()} vendidos
            </p>
          </div>
          <div className="text-right">
            <p
              className={`text-3xl font-black ${
                occupancyPct >= 70
                  ? 'text-green-400'
                  : occupancyPct >= 30
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`}
            >
              {occupancyPct.toFixed(1)}%
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Ocupación</p>
          </div>
        </div>
      </div>

      {/* ─── 2. Zone Breakdown ─── */}
      {zones.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Zonas
          </h4>
          <div className="bg-[#1a1a1a] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left px-3 py-2.5 font-medium">Zona</th>
                  <th className="text-center px-2 py-2.5 font-medium hidden sm:table-cell">Tipo</th>
                  <th className="text-right px-2 py-2.5 font-medium">Precio</th>
                  <th className="text-right px-2 py-2.5 font-medium">Vend.</th>
                  <th className="text-right px-2 py-2.5 font-medium hidden sm:table-cell">Disp.</th>
                  <th className="text-right px-2 py-2.5 font-medium">Cap.</th>
                  <th className="text-right px-3 py-2.5 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z, i) => {
                  const zPct = z.capacity > 0 ? (z.sold / z.capacity) * 100 : 0;
                  return (
                    <tr key={i} className="border-b border-gray-800/50 last:border-0">
                      <td className="px-3 py-2.5 text-white font-medium">
                        <span className="flex items-center gap-2">
                          <span
                            className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                              zPct >= 70 ? 'bg-green-500' : zPct >= 30 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                          />
                          {z.zone_name}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center hidden sm:table-cell">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            z.zone_type === 'general' || z.zone_type === 'ga'
                              ? 'bg-green-900/40 text-green-400'
                              : 'bg-orange-900/40 text-orange-400'
                          }`}
                        >
                          {z.zone_type === 'general' || z.zone_type === 'ga' ? 'GA' : 'RES'}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right text-gray-400">{fmt(z.price)}</td>
                      <td className="px-2 py-2.5 text-right text-white font-medium">{z.sold}</td>
                      <td className="px-2 py-2.5 text-right text-gray-400 hidden sm:table-cell">
                        {z.available}
                      </td>
                      <td className="px-2 py-2.5 text-right text-gray-400">{z.capacity}</td>
                      <td className="px-3 py-2.5 text-right text-white font-medium">{fmt(z.revenue)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-700">
                  <td colSpan={3} className="px-3 py-2.5 text-white font-bold text-xs hidden sm:table-cell">
                    Total
                  </td>
                  <td colSpan={1} className="px-3 py-2.5 text-white font-bold text-xs sm:hidden">
                    Total
                  </td>
                  <td className="px-2 py-2.5 text-right text-white font-bold text-xs hidden sm:table-cell" />
                  <td className="px-2 py-2.5 text-right text-white font-bold text-xs">
                    {zones.reduce((s, z) => s + z.sold, 0)}
                  </td>
                  <td className="px-2 py-2.5 text-right text-white font-bold text-xs hidden sm:table-cell">
                    {zones.reduce((s, z) => s + z.available, 0)}
                  </td>
                  <td className="px-2 py-2.5 text-right text-white font-bold text-xs">
                    {zones.reduce((s, z) => s + z.capacity, 0)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-white font-bold text-xs">
                    {fmt(zones.reduce((s, z) => s + z.revenue, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ─── 3. Coupons Applied ─── */}
      {coupons.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Cupones Aplicados
          </h4>
          <div className="bg-[#1a1a1a] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left px-3 py-2.5 font-medium">Código</th>
                  <th className="text-right px-3 py-2.5 font-medium">Usos</th>
                  <th className="text-right px-3 py-2.5 font-medium">Descuento Total</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.code} className="border-b border-gray-800/50 last:border-0">
                    <td className="px-3 py-2.5">
                      <span className="bg-red-900/30 text-red-400 px-2 py-0.5 rounded text-[11px] font-mono font-medium">
                        {c.code}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-white">{c.uses}</td>
                    <td className="px-3 py-2.5 text-right text-red-400 font-medium">
                      -{fmt(c.totalDiscount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 4. Sales by Channel ─── */}
      {channels.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Ventas por Canal
          </h4>
          <div className="bg-[#1a1a1a] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left px-3 py-2.5 font-medium">Canal</th>
                  <th className="text-right px-3 py-2.5 font-medium">Órdenes</th>
                  <th className="text-right px-3 py-2.5 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((ch) => (
                  <tr key={ch.channel} className="border-b border-gray-800/50 last:border-0">
                    <td className="px-3 py-2.5 text-white font-medium">{ch.channel}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400">{ch.orders}</td>
                    <td className="px-3 py-2.5 text-right text-white font-medium">{fmt(ch.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 5. Financial Summary ─── */}
      <div>
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Resumen Financiero
        </h4>
        <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Ingreso bruto</span>
            <span className="text-white font-medium">{fmt(grossRevenue)}</span>
          </div>
          {totalDiscounts > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Descuentos</span>
              <span className="text-red-400 font-medium">-{fmt(totalDiscounts)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm border-t border-gray-800 pt-2">
            <span className="text-gray-400">Ventas netas</span>
            <span className="text-white font-bold">{fmt(netSales)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">
              Comisión Dulos ({(commissionRate * 100).toFixed(0)}%)
            </span>
            <span className="text-gray-400">-{fmt(commission)}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-gray-700 pt-2">
            <span className="text-white font-bold">Payout estimado</span>
            <span className="text-green-400 font-bold text-base">{fmt(estimatedPayout)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
