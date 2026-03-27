'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
  fetchVenues,
  fetchVenueSections,
  fetchVenueSeats,
  fetchAllVenueSections,
  Venue,
  VenueSection,
  VenueSeat,
} from '../lib/supabase';
import SeatMapperPage from './SeatMapperPage';

/* ─── Helpers ─── */
const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ─── Badges ─── */
function SeatmapBadge({ has }: { has: boolean }) {
  return has
    ? <span className="text-[10px] bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded-full">Seatmap</span>
    : <span className="text-[10px] bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">GA</span>;
}

function TypeBadge({ type }: { type: string }) {
  return type === 'reserved'
    ? <span className="text-[10px] bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded-full">Reserved</span>
    : <span className="text-[10px] bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">GA</span>;
}

/* ─── Skeleton ─── */
function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="bg-[#111] border border-gray-800 rounded-lg p-4 animate-pulse">
          <div className="h-20 bg-gray-800 rounded mb-3" />
          <div className="h-4 bg-gray-800 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-800 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

/* ─── SVG Preview ─── */
function SvgPreview({ url, className }: { url: string; className?: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    fetch(url).then(r => r.text()).then(setSvg).catch(() => setSvg(null));
  }, [url]);

  if (!svg) return <div className={`bg-gray-800 rounded flex items-center justify-center text-gray-600 text-xs ${className || ''}`}>Sin mapa</div>;
  return (
    <div
      className={`bg-[#0a0a0a] rounded overflow-hidden ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ maxHeight: '100%' }}
    />
  );
}

/* ─── Mutation helper ─── */
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

/* ─── Section Form ─── */
interface SectionFormData {
  name: string;
  slug: string;
  section_type: string;
  capacity: string;
  sort_order: string;
}

const emptySectionForm: SectionFormData = { name: '', slug: '', section_type: 'ga', capacity: '', sort_order: '0' };

function SectionForm({ initial, onSave, onCancel, saving }: {
  initial: SectionFormData;
  onSave: (data: SectionFormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState(initial);
  const updateField = (k: keyof SectionFormData, v: string) => {
    const next = { ...form, [k]: v };
    if (k === 'name') next.slug = slugify(v);
    setForm(next);
  };

  return (
    <tr className="bg-[#0d0d0d]">
      <td className="px-3 py-2">
        <input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="Nombre"
          className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-1 text-sm text-white w-full focus:border-[#EF4444] focus:outline-none" />
      </td>
      <td className="px-3 py-2">
        <input value={form.slug} onChange={e => updateField('slug', e.target.value)} placeholder="slug"
          className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-1 text-sm text-gray-400 w-full font-mono focus:border-[#EF4444] focus:outline-none" />
      </td>
      <td className="px-3 py-2">
        <select value={form.section_type} onChange={e => updateField('section_type', e.target.value)}
          className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-[#EF4444] focus:outline-none">
          <option value="ga">GA</option>
          <option value="reserved">Reserved</option>
        </select>
      </td>
      <td className="px-3 py-2">
        <input value={form.capacity} onChange={e => updateField('capacity', e.target.value)} placeholder="—" type="number"
          className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-1 text-sm text-white w-20 focus:border-[#EF4444] focus:outline-none" />
      </td>
      <td className="px-3 py-2">
        <input value={form.sort_order} onChange={e => updateField('sort_order', e.target.value)} type="number"
          className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-1 text-sm text-white w-16 focus:border-[#EF4444] focus:outline-none" />
      </td>
      <td className="px-3 py-2 text-right space-x-2">
        <button onClick={() => onSave(form)} disabled={saving || !form.name || !form.slug}
          className="text-xs bg-[#EF4444] text-white px-3 py-1 rounded hover:bg-red-600 disabled:opacity-40 transition-colors">
          {saving ? '...' : 'Guardar'}
        </button>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-white transition-colors">Cancelar</button>
      </td>
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VENUE DETAIL
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Venue Form (Create/Edit) ─── */
const TIMEZONES = ['America/Mexico_City', 'America/Monterrey', 'America/Cancun', 'America/Chihuahua', 'America/Tijuana', 'America/Hermosillo', 'America/Mazatlan'];
const inpCls = 'w-full rounded-lg border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#EF4444] focus:outline-none';
const lblCls = 'block text-xs text-gray-400 mb-1';

interface VenueFormData {
  name: string; slug: string; address: string; city: string; state: string;
  postal_code: string; timezone: string; capacity: string; has_seatmap: boolean;
  latitude: string; longitude: string; maps_url: string;
}

function emptyVenueForm(): VenueFormData {
  return { name: '', slug: '', address: '', city: '', state: '', postal_code: '', timezone: 'America/Mexico_City', capacity: '', has_seatmap: false, latitude: '', longitude: '', maps_url: '' };
}

function venueToForm(v: Venue): VenueFormData {
  return {
    name: v.name, slug: v.slug, address: v.address || '', city: v.city || '',
    state: v.state || '', postal_code: v.postal_code || '', timezone: v.timezone,
    capacity: v.capacity ? String(v.capacity) : '', has_seatmap: v.has_seatmap || false,
    latitude: v.latitude ? String(v.latitude) : '', longitude: v.longitude ? String(v.longitude) : '',
    maps_url: v.maps_url || '',
  };
}

function CreateVenueModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<VenueFormData>(emptyVenueForm());
  const [saving, setSaving] = useState(false);
  const upd = (k: keyof VenueFormData, v: string | boolean) => {
    const next = { ...form, [k]: v };
    if (k === 'name' && typeof v === 'string') next.slug = slugify(v);
    setForm(next);
  };

  useEffect(() => { if (open) setForm(emptyVenueForm()); }, [open]);

  const handleCreate = async () => {
    if (!form.name || !form.slug) return;
    setSaving(true);
    try {
      await supabaseMutate('POST', 'venues', undefined, {
        name: form.name, slug: form.slug, address: form.address || null,
        city: form.city || null, state: form.state || null, postal_code: form.postal_code || null,
        timezone: form.timezone, capacity: form.capacity ? parseInt(form.capacity) : null,
        has_seatmap: form.has_seatmap, country: 'México',
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        maps_url: form.maps_url || null,
      });
      toast.success(`Venue "${form.name}" creado`);
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Error creating venue');
    } finally { setSaving(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0f0f0f] border border-gray-800 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Nuevo Venue</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>
        <div className="space-y-3">
          <div><label className={lblCls}>Nombre *</label><input className={inpCls} value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Teatro Metropolitano" /></div>
          <div><label className={lblCls}>Slug</label><input className={inpCls} value={form.slug} onChange={e => upd('slug', e.target.value)} /></div>
          <div><label className={lblCls}>Dirección</label><input className={inpCls} value={form.address} onChange={e => upd('address', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lblCls}>Ciudad</label><input className={inpCls} value={form.city} onChange={e => upd('city', e.target.value)} /></div>
            <div><label className={lblCls}>Estado</label><input className={inpCls} value={form.state} onChange={e => upd('state', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lblCls}>Timezone</label><select className={inpCls} value={form.timezone} onChange={e => upd('timezone', e.target.value)}>{TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('America/', '')}</option>)}</select></div>
            <div><label className={lblCls}>Capacidad</label><input type="number" className={inpCls} value={form.capacity} onChange={e => upd('capacity', e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="has_seatmap" checked={form.has_seatmap} onChange={e => upd('has_seatmap', e.target.checked)} className="accent-[#EF4444]" />
            <label htmlFor="has_seatmap" className="text-sm text-gray-300">Tiene asientos numerados (seatmap)</label>
          </div>
          <div><label className={lblCls}>Google Maps URL</label><input className={inpCls} value={form.maps_url} onChange={e => upd('maps_url', e.target.value)} placeholder="https://maps.google.com/..." /></div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
          <button onClick={handleCreate} disabled={saving || !form.name} className="px-5 py-2 text-sm bg-[#EF4444] text-white rounded-lg hover:bg-red-600 disabled:opacity-40 transition-colors">
            {saving ? 'Creando...' : 'Crear Venue'}
          </button>
        </div>
      </div>
    </div>
  );
}

type DetailTab = 'info' | 'secciones' | 'asientos';

function VenueDetail({ venue: initialVenue, onBack, onVenueUpdated }: { venue: Venue; onBack: () => void; onVenueUpdated: () => void }) {
  const [venue, setVenue] = useState(initialVenue);
  const [tab, setTab] = useState<DetailTab>('info');
  const [sections, setSections] = useState<VenueSection[]>([]);
  const [seats, setSeats] = useState<VenueSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState<VenueFormData>(venueToForm(initialVenue));
  const [uploadingSvg, setUploadingSvg] = useState(false);
  const [showMapper, setShowMapper] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sec, st] = await Promise.all([
        fetchVenueSections(venue.id),
        fetchVenueSeats(venue.id),
      ]);
      setSections(sec);
      setSeats(st);
    } catch (e) {
      toast.error('Error loading venue data');
    } finally {
      setLoading(false);
    }
  }, [venue.id]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ─── Section CRUD ─── */
  const handleCreateSection = async (form: SectionFormData) => {
    setSaving(true);
    try {
      await supabaseMutate('POST', 'venue_sections', undefined, {
        venue_id: venue.id,
        name: form.name,
        slug: form.slug,
        section_type: form.section_type,
        capacity: form.capacity ? parseInt(form.capacity) : null,
        sort_order: parseInt(form.sort_order) || 0,
      });
      toast.success(`Sección "${form.name}" creada`);
      setAdding(false);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || 'Error creating section');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSection = async (id: string, form: SectionFormData) => {
    setSaving(true);
    try {
      await supabaseMutate('PATCH', 'venue_sections', `id=eq.${id}`, {
        name: form.name,
        slug: form.slug,
        section_type: form.section_type,
        capacity: form.capacity ? parseInt(form.capacity) : null,
        sort_order: parseInt(form.sort_order) || 0,
      });
      toast.success(`Sección "${form.name}" actualizada`);
      setEditingId(null);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || 'Error updating section');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSection = async (sec: VenueSection) => {
    const seatCount = seats.filter(s => s.section === sec.slug).length;
    const msg = seatCount > 0
      ? `¿Eliminar "${sec.name}"? Tiene ${seatCount} asientos vinculados.`
      : `¿Eliminar "${sec.name}"?`;
    if (!confirm(msg)) return;
    try {
      await supabaseMutate('DELETE', 'venue_sections', `id=eq.${sec.id}`);
      toast.success(`Sección "${sec.name}" eliminada`);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || 'Error deleting section');
    }
  };

  /* ─── Seats grouped by section ─── */
  const seatsBySection = useMemo(() => {
    const map = new Map<string, VenueSeat[]>();
    for (const s of seats) {
      const key = s.section || 'sin-seccion';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [seats]);

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'info', label: 'Información' },
    { id: 'secciones', label: `Secciones (${sections.length})` },
    { id: 'asientos', label: `Asientos (${seats.length})` },
  ];

  if (showMapper) {
    return <SeatMapperPage venueId={venue.id} venueName={venue.name} onBack={() => setShowMapper(false)} />;
  }

  return (
    <div>
      {/* Header */}
      <button onClick={onBack} className="text-gray-400 hover:text-white text-sm mb-4 flex items-center gap-1 transition-colors">
        <span>←</span> Venues
      </button>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">{venue.name}</h2>
          <p className="text-sm text-gray-400">{[venue.city, venue.state].filter(Boolean).join(', ')} · {venue.timezone}</p>
        </div>
        <div className="flex items-center gap-3">
          {venue.has_seatmap && seats.length > 0 && (
            <button onClick={() => setShowMapper(true)}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
              🗺️ Mapear asientos
            </button>
          )}
          <SeatmapBadge has={venue.has_seatmap || false} />
          {venue.capacity && <span className="text-xs text-gray-400">{venue.capacity} cap</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-800 mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`pb-2 text-sm font-medium transition-colors relative ${tab === t.id ? 'text-[#EF4444]' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
            {tab === t.id && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#EF4444]" />}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-800 rounded" />)}
        </div>
      ) : (
        <>
          {/* ─── INFO TAB ─── */}
          {tab === 'info' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#111] border border-gray-800 rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Datos del Venue</h3>
                  {!editingInfo ? (
                    <button onClick={() => { setInfoForm(venueToForm(venue)); setEditingInfo(true); }}
                      className="text-xs text-gray-400 hover:text-[#EF4444] transition-colors">✏️ Editar</button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={async () => {
                        setSaving(true);
                        try {
                          await supabaseMutate('PATCH', 'venues', `id=eq.${venue.id}`, {
                            name: infoForm.name, slug: infoForm.slug, address: infoForm.address || null,
                            city: infoForm.city || null, state: infoForm.state || null,
                            postal_code: infoForm.postal_code || null, timezone: infoForm.timezone,
                            capacity: infoForm.capacity ? parseInt(infoForm.capacity) : null,
                            has_seatmap: infoForm.has_seatmap,
                            latitude: infoForm.latitude ? parseFloat(infoForm.latitude) : null,
                            longitude: infoForm.longitude ? parseFloat(infoForm.longitude) : null,
                            maps_url: infoForm.maps_url || null,
                          });
                          setVenue({
                            ...venue, name: infoForm.name, slug: infoForm.slug,
                            address: infoForm.address, city: infoForm.city, state: infoForm.state,
                            postal_code: infoForm.postal_code, timezone: infoForm.timezone,
                            capacity: infoForm.capacity ? parseInt(infoForm.capacity) : venue.capacity,
                            has_seatmap: infoForm.has_seatmap,
                            latitude: infoForm.latitude ? parseFloat(infoForm.latitude) : venue.latitude,
                            longitude: infoForm.longitude ? parseFloat(infoForm.longitude) : venue.longitude,
                            maps_url: infoForm.maps_url,
                          });
                          toast.success('Venue actualizado');
                          setEditingInfo(false);
                          onVenueUpdated();
                        } catch (e: any) { toast.error(e.message || 'Error'); }
                        finally { setSaving(false); }
                      }} disabled={saving} className="text-xs bg-[#EF4444] text-white px-3 py-1 rounded hover:bg-red-600 disabled:opacity-40">
                        {saving ? '...' : 'Guardar'}
                      </button>
                      <button onClick={() => setEditingInfo(false)} className="text-xs text-gray-400 hover:text-white">Cancelar</button>
                    </div>
                  )}
                </div>
                {editingInfo ? (
                  <div className="space-y-3">
                    <div><label className={lblCls}>Nombre</label><input className={inpCls} value={infoForm.name} onChange={e => setInfoForm(f => ({ ...f, name: e.target.value }))} /></div>
                    <div><label className={lblCls}>Slug</label><input className={inpCls} value={infoForm.slug} onChange={e => setInfoForm(f => ({ ...f, slug: e.target.value }))} /></div>
                    <div><label className={lblCls}>Dirección</label><input className={inpCls} value={infoForm.address} onChange={e => setInfoForm(f => ({ ...f, address: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={lblCls}>Ciudad</label><input className={inpCls} value={infoForm.city} onChange={e => setInfoForm(f => ({ ...f, city: e.target.value }))} /></div>
                      <div><label className={lblCls}>Estado</label><input className={inpCls} value={infoForm.state} onChange={e => setInfoForm(f => ({ ...f, state: e.target.value }))} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={lblCls}>Timezone</label><select className={inpCls} value={infoForm.timezone} onChange={e => setInfoForm(f => ({ ...f, timezone: e.target.value }))}>{TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('America/', '')}</option>)}</select></div>
                      <div><label className={lblCls}>Capacidad</label><input type="number" className={inpCls} value={infoForm.capacity} onChange={e => setInfoForm(f => ({ ...f, capacity: e.target.value }))} /></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={infoForm.has_seatmap} onChange={e => setInfoForm(f => ({ ...f, has_seatmap: e.target.checked }))} className="accent-[#EF4444]" />
                      <span className="text-sm text-gray-300">Asientos numerados (seatmap)</span>
                    </div>
                    <div><label className={lblCls}>Google Maps URL</label><input className={inpCls} value={infoForm.maps_url} onChange={e => setInfoForm(f => ({ ...f, maps_url: e.target.value }))} /></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {([
                      ['Nombre', venue.name], ['Slug', venue.slug],
                      ['Dirección', venue.address || '—'], ['Ciudad', venue.city || '—'],
                      ['Estado', venue.state || '—'], ['C.P.', venue.postal_code || '—'],
                      ['Timezone', venue.timezone],
                      ['Capacidad', venue.capacity ? venue.capacity.toLocaleString() : '—'],
                      ['Seatmap', venue.has_seatmap ? 'Sí' : 'No'],
                    ] as [string, string][]).map(([label, value]) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-gray-400">{label}</span>
                        <span className="text-white font-mono">{value}</span>
                      </div>
                    ))}
                    {venue.maps_url && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Maps</span>
                        <a href={venue.maps_url} target="_blank" rel="noopener" className="text-[#EF4444] hover:underline text-xs">Abrir ↗</a>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="bg-[#111] border border-gray-800 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">Mapa SVG</h3>
                  <label className={`text-xs cursor-pointer transition-colors ${uploadingSvg ? 'text-gray-500' : 'text-[#EF4444] hover:text-red-300'}`}>
                    {uploadingSvg ? 'Subiendo...' : '📁 Subir SVG'}
                    <input type="file" accept=".svg" className="hidden" disabled={uploadingSvg} onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingSvg(true);
                      try {
                        const fd = new FormData();
                        fd.append('file', file);
                        fd.append('venueSlug', venue.slug);
                        const res = await fetch('/api/admin/upload-svg', { method: 'POST', body: fd });
                        if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
                        const { url, zones } = await res.json();
                        await supabaseMutate('PATCH', 'venues', `id=eq.${venue.id}`, { layout_svg_url: url });
                        setVenue({ ...venue, layout_svg_url: url } as Venue);
                        toast.success(`SVG subido${zones?.length ? ` — ${zones.length} zonas detectadas: ${zones.join(', ')}` : ''}`);
                        onVenueUpdated();
                      } catch (err: any) { toast.error(err.message || 'Error uploading SVG'); }
                      finally { setUploadingSvg(false); e.target.value = ''; }
                    }} />
                  </label>
                </div>
                {venue.layout_svg_url ? (
                  <SvgPreview url={venue.layout_svg_url + '?t=' + Date.now()} className="h-64 w-full" />
                ) : (
                  <div className="h-64 bg-gray-800/50 rounded flex items-center justify-center text-gray-500 text-sm text-center px-4">
                    Sin SVG — usa el botón &quot;Subir SVG&quot; arriba
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── SECCIONES TAB ─── */}
          {tab === 'secciones' && (
            <div className="bg-[#111] border border-gray-800 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs uppercase border-b border-gray-800">
                      <th className="text-left px-3 py-3 font-medium">Nombre</th>
                      <th className="text-left px-3 py-3 font-medium">Slug</th>
                      <th className="text-left px-3 py-3 font-medium">Tipo</th>
                      <th className="text-left px-3 py-3 font-medium">Capacidad</th>
                      <th className="text-left px-3 py-3 font-medium">Orden</th>
                      <th className="text-right px-3 py-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {sections.map(sec => (
                      editingId === sec.id ? (
                        <SectionForm key={sec.id} saving={saving}
                          initial={{ name: sec.name, slug: sec.slug, section_type: sec.section_type, capacity: sec.capacity?.toString() || '', sort_order: sec.sort_order.toString() }}
                          onSave={data => handleUpdateSection(sec.id, data)}
                          onCancel={() => setEditingId(null)} />
                      ) : (
                        <tr key={sec.id} className="hover:bg-[#1a1a1a] transition-colors">
                          <td className="px-3 py-3 text-white font-medium">{sec.name}</td>
                          <td className="px-3 py-3 text-gray-400 font-mono text-xs">{sec.slug}</td>
                          <td className="px-3 py-3"><TypeBadge type={sec.section_type} /></td>
                          <td className="px-3 py-3 text-gray-300">{sec.capacity ?? '—'}</td>
                          <td className="px-3 py-3 text-gray-500">{sec.sort_order}</td>
                          <td className="px-3 py-3 text-right space-x-2">
                            <button onClick={() => setEditingId(sec.id)} className="text-xs text-gray-400 hover:text-white transition-colors">✏️</button>
                            <button onClick={() => handleDeleteSection(sec)} className="text-xs text-gray-400 hover:text-red-400 transition-colors">🗑️</button>
                          </td>
                        </tr>
                      )
                    ))}
                    {adding && (
                      <SectionForm initial={emptySectionForm} saving={saving}
                        onSave={handleCreateSection}
                        onCancel={() => setAdding(false)} />
                    )}
                  </tbody>
                </table>
              </div>
              {sections.length === 0 && !adding && (
                <div className="text-center py-8 text-gray-500 text-sm">No hay secciones definidas para este venue</div>
              )}
              {!adding && !editingId && (
                <div className="border-t border-gray-800 p-3">
                  <button onClick={() => setAdding(true)}
                    className="text-xs text-[#EF4444] hover:text-red-300 font-medium transition-colors">
                    + Agregar sección
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─── ASIENTOS TAB ─── */}
          {tab === 'asientos' && (
            <div className="space-y-4">
              {seats.length === 0 ? (
                <div className="bg-[#111] border border-gray-800 rounded-lg p-8 text-center text-gray-500 text-sm">
                  No hay asientos cargados para este venue
                  <p className="text-xs text-gray-600 mt-2">
                    Para venues con asientos numerados, usar el script <code className="bg-gray-800 px-1 py-0.5 rounded">generate_seats</code>
                  </p>
                </div>
              ) : (
                Array.from(seatsBySection.entries()).map(([sectionSlug, sectionSeats]) => {
                  const sec = sections.find(s => s.slug === sectionSlug);
                  const rows = new Map<string, VenueSeat[]>();
                  for (const s of sectionSeats) {
                    if (!rows.has(s.row_label)) rows.set(s.row_label, []);
                    rows.get(s.row_label)!.push(s);
                  }
                  return (
                    <div key={sectionSlug} className="bg-[#111] border border-gray-800 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium text-sm">{sec?.name || sectionSlug}</span>
                          {sec && <TypeBadge type={sec.section_type} />}
                        </div>
                        <span className="text-xs text-gray-400">{sectionSeats.length} asientos · {rows.size} filas</span>
                      </div>
                      <div className="overflow-x-auto max-h-64">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500 uppercase border-b border-gray-800/50">
                              <th className="text-left px-3 py-2 font-medium">Fila</th>
                              <th className="text-left px-3 py-2 font-medium">Asiento</th>
                              <th className="text-left px-3 py-2 font-medium">Tipo</th>
                              <th className="text-left px-3 py-2 font-medium">Orden</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800/30">
                            {sectionSeats.slice(0, 50).map(s => (
                              <tr key={s.id} className="hover:bg-[#1a1a1a]">
                                <td className="px-3 py-1.5 text-white font-mono">{s.row_label}</td>
                                <td className="px-3 py-1.5 text-gray-300 font-mono">{s.seat_number}</td>
                                <td className="px-3 py-1.5 text-gray-400">{s.seat_type || 'standard'}</td>
                                <td className="px-3 py-1.5 text-gray-500">{s.sort_order}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {sectionSeats.length > 50 && (
                          <div className="text-center py-2 text-xs text-gray-500">
                            Mostrando 50 de {sectionSeats.length} asientos
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE — Venue List + Detail
   ═══════════════════════════════════════════════════════════════════ */

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [allSections, setAllSections] = useState<VenueSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Venue | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadVenues = useCallback(async () => {
    try {
      const [v, sec] = await Promise.all([fetchVenues(), fetchAllVenueSections()]);
      setVenues(v);
      setAllSections(sec);
    } catch (e) {
      toast.error('Error loading venues');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVenues(); }, [loadVenues]);

  const sectionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of allSections) {
      map.set(s.venue_id, (map.get(s.venue_id) || 0) + 1);
    }
    return map;
  }, [allSections]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return venues
      .filter(v => !q || v.name.toLowerCase().includes(q) || (v.city || '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [venues, search]);

  if (selected) {
    return <VenueDetail venue={selected} onBack={() => setSelected(null)} onVenueUpdated={loadVenues} />;
  }

  return (
    <div>
      <CreateVenueModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={loadVenues} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Venues</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{venues.length} venues</span>
          <button onClick={() => setShowCreate(true)}
            className="text-xs bg-[#EF4444] text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors font-medium">
            + Nuevo Venue
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o ciudad..."
          className="w-full sm:w-80 bg-[#111] border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#EF4444] focus:outline-none transition-colors"
        />
      </div>

      {loading ? <GridSkeleton /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(v => (
            <button
              key={v.id}
              onClick={() => setSelected(v)}
              className="bg-[#111] border border-gray-800 rounded-lg p-4 text-left hover:border-gray-600 transition-all group"
            >
              {/* SVG thumbnail */}
              <div className="h-24 mb-3 rounded overflow-hidden bg-[#0a0a0a]">
                {v.layout_svg_url ? (
                  <SvgPreview url={v.layout_svg_url} className="h-full w-full" />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-700 text-xs">Sin mapa</div>
                )}
              </div>

              {/* Info */}
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-white truncate group-hover:text-[#EF4444] transition-colors">{v.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{[v.city, v.state].filter(Boolean).join(', ') || '—'}</p>
                </div>
                <SeatmapBadge has={v.has_seatmap || false} />
              </div>

              {/* Stats */}
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                <span>{sectionCounts.get(v.id) || 0} secciones</span>
                {v.capacity && <span>· {v.capacity} cap</span>}
                <span>· {v.timezone?.replace('America/', '')}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500 text-sm">
          {search ? 'No se encontraron venues' : 'No hay venues registrados'}
        </div>
      )}
    </div>
  );
}
