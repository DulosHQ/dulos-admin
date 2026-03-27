'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
  fetchVenueSeats,
  fetchVenueSections,
  VenueSeat,
  VenueSection,
} from '../lib/supabase';

/* ─── Types ─── */
interface TicketZone {
  id: string;
  event_id: string;
  zone_name: string;
  zone_type: string;
  price: number;
  color?: string;
}

interface DulosEvent {
  id: string;
  name: string;
  venue_id: string;
}

interface EventSectionSeat {
  id: string;
  event_section_id: string;
  venue_seat_id: string;
  zone_id: string | null;
  status: string;
}

interface RowGroup {
  label: string;
  section: string;
  seatCount: number;
  seatIds: string[];      // venue_seat ids
  essSeatIds: string[];   // event_section_seat ids
  currentZoneId: string | null;
}

/* ─── Helpers ─── */
const fmt = (n: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n);

async function supabaseFetch<T>(endpoint: string): Promise<T> {
  const [path, qs] = endpoint.split('?');
  const params = new URLSearchParams(qs || '');
  const proxyParams = new URLSearchParams();
  proxyParams.set('path', path);
  params.forEach((v, k) => proxyParams.set(k, v));
  const res = await fetch(`/api/supabase-proxy?${proxyParams.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
  return res.json();
}

async function supabaseMutate(method: 'POST' | 'PATCH' | 'DELETE', path: string, query?: string, payload?: unknown) {
  const res = await fetch('/api/supabase-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, path, query, payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.detail || err.error || 'Mutation failed');
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/* ─── Zone color palette ─── */
const ZONE_COLORS = ['#E63946', '#2A7AE8', '#E88D2A', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4'];

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */

interface Props {
  venueId: string;
  venueName: string;
  onBack: () => void;
}

export default function SeatMapperPage({ venueId, venueName, onBack }: Props) {
  const [events, setEvents] = useState<DulosEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [zones, setZones] = useState<TicketZone[]>([]);
  const [venueSeats, setVenueSeats] = useState<VenueSeat[]>([]);
  const [venueSections, setVenueSections] = useState<VenueSection[]>([]);
  const [esSeats, setEsSeats] = useState<EventSectionSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  // Active zone for assignment
  const [activeZoneId, setActiveZoneId] = useState<string>('');

  // Row selections: rowKey → zoneId
  const [rowAssignments, setRowAssignments] = useState<Map<string, string>>(new Map());

  // Load venue data + events that use this venue with reserved zones
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [seats, sections, evts] = await Promise.all([
          fetchVenueSeats(venueId),
          fetchVenueSections(venueId),
          supabaseFetch<DulosEvent[]>(`events?venue_id=eq.${venueId}&status=eq.active&order=name.asc`),
        ]);
        setVenueSeats(seats);
        setVenueSections(sections);
        setEvents(evts);
      } catch (e) {
        toast.error('Error loading venue data');
      } finally {
        setLoading(false);
      }
    })();
  }, [venueId]);

  // When event is selected, load its zones and event_section_seats
  useEffect(() => {
    if (!selectedEventId) {
      setZones([]);
      setEsSeats([]);
      setRowAssignments(new Map());
      return;
    }
    (async () => {
      try {
        const [zoneData, esData] = await Promise.all([
          supabaseFetch<TicketZone[]>(`ticket_zones?event_id=eq.${selectedEventId}&zone_type=eq.reserved&order=price.desc`),
          supabaseFetch<EventSectionSeat[]>(`event_section_seats?select=id,event_section_id,venue_seat_id,zone_id,status&limit=2000`),
        ]);

        // Filter esSeats to only those whose venue_seat_id is in our venue
        const venueSeatIds = new Set(venueSeats.map(s => s.id));
        const filtered = esData.filter(es => venueSeatIds.has(es.venue_seat_id));

        // Assign colors to zones
        const coloredZones = zoneData.map((z, i) => ({ ...z, color: z.color || ZONE_COLORS[i % ZONE_COLORS.length] }));
        setZones(coloredZones);
        setEsSeats(filtered);

        // Build initial row assignments from existing zone_id mappings
        const seatToZone = new Map<string, string>();
        for (const es of filtered) {
          if (es.zone_id) seatToZone.set(es.venue_seat_id, es.zone_id);
        }

        const initialAssignments = new Map<string, string>();
        const rows = groupSeatsByRow(venueSeats, filtered);
        for (const row of rows) {
          if (row.currentZoneId) {
            initialAssignments.set(rowKey(row), row.currentZoneId);
          }
        }
        setRowAssignments(initialAssignments);

        if (coloredZones.length > 0) setActiveZoneId(coloredZones[0].id);
        if (filtered.length === 0) {
          toast.error('Este evento no tiene event_section_seats. Necesita crearse primero al configurar el evento como reserved.');
        }
      } catch (e: any) {
        toast.error(e.message || 'Error loading event data');
      }
    })();
  }, [selectedEventId, venueSeats]);

  // Group seats by row
  function groupSeatsByRow(seats: VenueSeat[], esSeatsLocal: EventSectionSeat[]): RowGroup[] {
    const seatToEss = new Map<string, EventSectionSeat>();
    for (const es of esSeatsLocal) seatToEss.set(es.venue_seat_id, es);

    const rowMap = new Map<string, RowGroup>();
    for (const seat of seats) {
      const key = `${seat.section}::${seat.row_label}`;
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          label: seat.row_label,
          section: seat.section,
          seatCount: 0,
          seatIds: [],
          essSeatIds: [],
          currentZoneId: null,
        });
      }
      const row = rowMap.get(key)!;
      row.seatCount++;
      row.seatIds.push(seat.id);
      const ess = seatToEss.get(seat.id);
      if (ess) {
        row.essSeatIds.push(ess.id);
        if (ess.zone_id && !row.currentZoneId) row.currentZoneId = ess.zone_id;
      }
    }
    return Array.from(rowMap.values()).sort((a, b) => {
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      return a.label.localeCompare(b.label);
    });
  }

  function rowKey(row: RowGroup): string {
    return `${row.section}::${row.label}`;
  }

  const rows = useMemo(() => groupSeatsByRow(venueSeats, esSeats), [venueSeats, esSeats]);

  // Toggle row assignment
  const toggleRow = (row: RowGroup) => {
    if (!activeZoneId) return;
    const key = rowKey(row);
    setRowAssignments(prev => {
      const next = new Map(prev);
      if (next.get(key) === activeZoneId) {
        next.delete(key); // Unassign
      } else {
        next.set(key, activeZoneId); // Assign to active zone
      }
      return next;
    });
  };

  // Zone stats from current assignments
  const zoneStats = useMemo(() => {
    const stats = new Map<string, number>();
    for (const zone of zones) stats.set(zone.id, 0);
    for (const row of rows) {
      const zoneId = rowAssignments.get(rowKey(row));
      if (zoneId && stats.has(zoneId)) {
        stats.set(zoneId, (stats.get(zoneId) || 0) + row.seatCount);
      }
    }
    return stats;
  }, [zones, rows, rowAssignments]);

  const unassignedCount = useMemo(() => {
    return rows.reduce((sum, row) => {
      return sum + (rowAssignments.has(rowKey(row)) ? 0 : row.seatCount);
    }, 0);
  }, [rows, rowAssignments]);

  // Apply mapping
  const handleApply = async () => {
    if (esSeats.length === 0) {
      toast.error('No hay event_section_seats para este evento');
      return;
    }

    setApplying(true);
    try {
      // Build update batches: for each row, update all its event_section_seats
      const seatToEss = new Map<string, string>();
      for (const es of esSeats) seatToEss.set(es.venue_seat_id, es.id);

      let updated = 0;
      for (const row of rows) {
        const zoneId = rowAssignments.get(rowKey(row)) || null;
        const essIds = row.seatIds
          .map(sid => seatToEss.get(sid))
          .filter((id): id is string => !!id);

        if (essIds.length === 0) continue;

        // Batch update by event_section_seat ids
        const idFilter = essIds.map(id => `"${id}"`).join(',');
        await supabaseMutate('PATCH', 'event_section_seats', `id=in.(${idFilter})`, { zone_id: zoneId });
        updated += essIds.length;
      }

      // Recalculate schedule_inventory for each zone
      for (const zone of zones) {
        const count = zoneStats.get(zone.id) || 0;
        // Get all schedules for this event
        const schedules = await supabaseFetch<{ id: string }[]>(`schedules?event_id=eq.${selectedEventId}&select=id`);
        for (const sched of schedules) {
          // Update or create schedule_inventory
          const existing = await supabaseFetch<{ id: string }[]>(
            `schedule_inventory?schedule_id=eq.${sched.id}&zone_id=eq.${zone.id}&select=id&limit=1`
          );
          if (existing.length > 0) {
            await supabaseMutate('PATCH', 'schedule_inventory', `id=eq.${existing[0].id}`, { available: count, sold: 0, reserved: 0 });
          }
        }

        // Update ticket_zones capacity
        await supabaseMutate('PATCH', 'ticket_zones', `id=eq.${zone.id}`, {
          total_capacity: count,
          available: count,
          sold: 0,
        });
      }

      toast.success(`✅ Mapeo aplicado: ${updated} asientos actualizados`);
    } catch (e: any) {
      toast.error(e.message || 'Error applying mapping');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-800 rounded w-48" />
        <div className="h-40 bg-gray-800 rounded" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <button onClick={onBack} className="text-gray-400 hover:text-white text-sm mb-4 flex items-center gap-1 transition-colors">
        <span>←</span> {venueName}
      </button>
      <h2 className="text-xl font-bold text-white mb-1">Mapear Asientos</h2>
      <p className="text-sm text-gray-400 mb-6">{venueName} · {venueSeats.length} asientos en {rows.length} filas</p>

      {/* Event selector */}
      <div className="mb-6">
        <label className="block text-xs text-gray-400 mb-1">Evento</label>
        <select
          value={selectedEventId}
          onChange={e => setSelectedEventId(e.target.value)}
          className="w-full sm:w-96 bg-[#111] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#EF4444] focus:outline-none"
        >
          <option value="">— Seleccionar evento —</option>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
      </div>

      {!selectedEventId ? (
        <div className="bg-[#111] border border-gray-800 rounded-lg p-8 text-center text-gray-500 text-sm">
          Selecciona un evento para mapear asientos a zonas
        </div>
      ) : zones.length === 0 ? (
        <div className="bg-[#111] border border-gray-800 rounded-lg p-8 text-center text-gray-500 text-sm">
          Este evento no tiene zonas de tipo &quot;reserved&quot;.
          <p className="text-xs text-gray-600 mt-2">Las zonas reserved se crean al definir el evento en el EventWizard.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Zone selector + stats */}
          <div className="space-y-4">
            <div className="bg-[#111] border border-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Zonas del evento</h3>
              <div className="space-y-2">
                {zones.map(z => {
                  const count = zoneStats.get(z.id) || 0;
                  const isActive = activeZoneId === z.id;
                  return (
                    <button
                      key={z.id}
                      onClick={() => setActiveZoneId(z.id)}
                      className={`w-full text-left px-3 py-3 rounded-lg border transition-all ${
                        isActive ? 'border-white bg-[#1a1a1a]' : 'border-gray-800 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: z.color }} />
                        <span className="text-sm text-white font-medium">{z.zone_name}</span>
                        <span className="text-xs text-gray-400 ml-auto">{fmt(z.price)}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 ml-5">
                        {count} asientos asignados
                      </div>
                    </button>
                  );
                })}
              </div>
              {unassignedCount > 0 && (
                <div className="mt-3 px-3 py-2 bg-yellow-900/20 border border-yellow-800/30 rounded text-xs text-yellow-400">
                  ⚠️ {unassignedCount} asientos sin asignar
                </div>
              )}
            </div>

            {/* Apply button */}
            <button
              onClick={handleApply}
              disabled={applying || unassignedCount > 0}
              className="w-full py-3 bg-[#EF4444] text-white font-medium rounded-lg hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {applying ? 'Aplicando...' : 'Aplicar mapeo'}
            </button>
            {unassignedCount > 0 && (
              <p className="text-xs text-gray-500 text-center">Asigna todas las filas antes de aplicar</p>
            )}
          </div>

          {/* Right: Row list */}
          <div className="lg:col-span-2">
            <div className="bg-[#111] border border-gray-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Filas
                  <span className="text-gray-500 font-normal ml-2">
                    Click en una fila para asignarla a <span style={{ color: zones.find(z => z.id === activeZoneId)?.color || '#EF4444' }}>{zones.find(z => z.id === activeZoneId)?.zone_name || '—'}</span>
                  </span>
                </h3>
              </div>
              <div className="max-h-[600px] overflow-y-auto">
                {venueSections.map(sec => {
                  const secRows = rows.filter(r => r.section === sec.slug);
                  if (secRows.length === 0) return null;
                  return (
                    <div key={sec.id}>
                      <div className="px-4 py-2 bg-[#0d0d0d] text-xs text-gray-500 font-medium uppercase tracking-wider border-b border-gray-800/50">
                        {sec.name} · {secRows.reduce((s, r) => s + r.seatCount, 0)} asientos
                      </div>
                      {secRows.map(row => {
                        const key = rowKey(row);
                        const assignedZoneId = rowAssignments.get(key);
                        const assignedZone = zones.find(z => z.id === assignedZoneId);
                        const isAssignedToActive = assignedZoneId === activeZoneId;

                        return (
                          <button
                            key={key}
                            onClick={() => toggleRow(row)}
                            className={`w-full text-left px-4 py-2.5 flex items-center justify-between border-b border-gray-800/30 transition-all hover:bg-[#1a1a1a] ${
                              isAssignedToActive ? 'bg-[#1a1a1a]' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-5 h-5 rounded border-2 flex items-center justify-center text-[10px] transition-all"
                                style={{
                                  borderColor: assignedZone?.color || '#555',
                                  backgroundColor: assignedZone ? assignedZone.color + '30' : 'transparent',
                                }}
                              >
                                {assignedZone && '✓'}
                              </div>
                              <span className="text-sm text-white font-mono font-bold">Fila {row.label}</span>
                              <span className="text-xs text-gray-500">{row.seatCount} asientos</span>
                            </div>
                            {assignedZone ? (
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{
                                backgroundColor: assignedZone.color + '20',
                                color: assignedZone.color,
                              }}>
                                {assignedZone.zone_name}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-600">sin asignar</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
                {/* Rows without a section */}
                {rows.filter(r => !venueSections.some(s => s.slug === r.section)).length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-[#0d0d0d] text-xs text-gray-500 font-medium uppercase tracking-wider border-b border-gray-800/50">
                      Sin sección
                    </div>
                    {rows.filter(r => !venueSections.some(s => s.slug === r.section)).map(row => {
                      const key = rowKey(row);
                      const assignedZoneId = rowAssignments.get(key);
                      const assignedZone = zones.find(z => z.id === assignedZoneId);
                      return (
                        <button
                          key={key}
                          onClick={() => toggleRow(row)}
                          className="w-full text-left px-4 py-2.5 flex items-center justify-between border-b border-gray-800/30 transition-all hover:bg-[#1a1a1a]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded border-2 flex items-center justify-center text-[10px]"
                              style={{ borderColor: assignedZone?.color || '#555', backgroundColor: assignedZone ? assignedZone.color + '30' : 'transparent' }}>
                              {assignedZone && '✓'}
                            </div>
                            <span className="text-sm text-white font-mono font-bold">Fila {row.label}</span>
                            <span className="text-xs text-gray-500">{row.seatCount} asientos</span>
                          </div>
                          {assignedZone ? (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: assignedZone.color + '20', color: assignedZone.color }}>
                              {assignedZone.zone_name}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">sin asignar</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
