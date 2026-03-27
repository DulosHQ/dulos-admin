import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

/* ─── Helpers ─── */
async function supaInsert<T>(table: string, data: unknown): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers, body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`INSERT ${table} failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  return Array.isArray(json) ? json[0] : json;
}

async function supaDelete(table: string, filter: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE', headers,
  });
}

/* ─── Types ─── */
interface ZoneInput {
  zone_name: string;
  zone_type: 'ga' | 'reserved';
  price: number;
  original_price?: number | null;
  total_capacity: number;
  color: string;
  has_2x1: boolean;
}

interface ScheduleInput {
  date: string;       // YYYY-MM-DD local
  start_time: string; // HH:MM local
  end_time: string;   // HH:MM local
  total_capacity: number;
  staff_pin: string;
  staff_phone: string;
  staff_email: string;
}

interface EventInput {
  name: string;
  slug: string;
  venue_id: string;
  category: string;
  description: string;
  long_description: string;
  quote: string;
  image_url: string;
  poster_url: string;
  card_url: string;
  seo_title: string;
  seo_description: string;
  show_remaining: boolean;
  featured: boolean;
  sort_order: number;
  status: 'draft' | 'active';
  zones: ZoneInput[];
  schedules: ScheduleInput[];
  commission_rate: number;
  venue_timezone: string;
}

/* ─── Main ─── */
export async function POST(req: NextRequest) {
  try {
    const input: EventInput = await req.json();

    // Validate required fields
    if (!input.name) return NextResponse.json({ error: 'Nombre es requerido' }, { status: 400 });
    if (!input.venue_id) return NextResponse.json({ error: 'Venue es requerido' }, { status: 400 });
    if (!input.zones?.length) return NextResponse.json({ error: 'Al menos 1 zona es requerida' }, { status: 400 });
    if (!input.schedules?.length) return NextResponse.json({ error: 'Al menos 1 función es requerida' }, { status: 400 });

    // Validate zones
    for (const z of input.zones) {
      if (!z.zone_name) return NextResponse.json({ error: 'Cada zona necesita nombre' }, { status: 400 });
      if (z.price < 0) return NextResponse.json({ error: `Zona "${z.zone_name}": precio inválido` }, { status: 400 });
      if (z.zone_type === 'ga' && z.total_capacity <= 0) return NextResponse.json({ error: `Zona "${z.zone_name}": capacidad requerida para GA` }, { status: 400 });
    }

    // Validate schedules
    for (const s of input.schedules) {
      if (!s.date || !s.start_time) return NextResponse.json({ error: 'Cada función necesita fecha y hora' }, { status: 400 });
    }

    // Check slug uniqueness
    const slugCheck = await fetch(`${SUPABASE_URL}/rest/v1/events?slug=eq.${encodeURIComponent(input.slug)}&select=id&limit=1`, { headers });
    const existing = await slugCheck.json();
    if (existing?.length > 0) {
      return NextResponse.json({ error: `Slug "${input.slug}" ya existe. Intenta con otro.` }, { status: 409 });
    }

    // ─── Compute derived fields ─── 
    const sortedSchedules = [...input.schedules].sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
    const first = sortedSchedules[0];
    const last = sortedSchedules[sortedSchedules.length - 1];
    const tz = input.venue_timezone || 'America/Mexico_City';

    // Convert local date+time to UTC timestamptz
    function localToUTC(date: string, time: string): string {
      // Create date in the venue timezone, then let JS convert to UTC
      const dt = new Date(`${date}T${time}:00`);
      // Use Intl to get the offset for the venue timezone
      const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
      const parts = formatter.formatToParts(dt);
      const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || '';
      // Parse offset like "GMT-6" → -6
      const match = tzPart.match(/GMT([+-]?\d+(?::\d+)?)/);
      let offsetHours = 0;
      if (match) {
        const [h, m] = match[1].split(':').map(Number);
        offsetHours = h + (m ? m / 60 * Math.sign(h) : 0);
      }
      // Construct ISO string with offset
      const sign = offsetHours <= 0 ? '-' : '+';
      const absH = Math.abs(Math.floor(offsetHours));
      const absM = Math.abs(Math.round((offsetHours % 1) * 60));
      const offsetStr = `${sign}${String(absH).padStart(2, '0')}:${String(absM).padStart(2, '0')}`;
      return `${date}T${time}:00${offsetStr}`;
    }

    const startDateUTC = localToUTC(first.date, first.start_time);
    const endDateUTC = localToUTC(last.date, last.end_time || last.start_time);

    const eventType = input.schedules.length === 1 ? 'single' : 'recurring';
    const priceFrom = Math.min(...input.zones.map(z => z.price));
    const maxOriginalPrice = input.zones.some(z => z.original_price && z.original_price > 0)
      ? Math.max(...input.zones.filter(z => z.original_price && z.original_price > 0).map(z => z.original_price!))
      : null;
    const totalCapacity = input.zones.reduce((s, z) => s + z.total_capacity, 0);

    // ─── Track created IDs for rollback ───
    const created: { table: string; filter: string }[] = [];

    try {
      // 1. INSERT event
      const event = await supaInsert<{ id: string }>('events', {
        name: input.name,
        slug: input.slug,
        venue_id: input.venue_id,
        category: input.category,
        event_type: eventType,
        start_date: startDateUTC,
        end_date: endDateUTC,
        price_from: priceFrom,
        original_price: maxOriginalPrice,
        status: input.status,
        description: input.description || null,
        long_description: input.long_description || null,
        quote: input.quote || null,
        image_url: input.image_url || null,
        poster_url: input.poster_url || null,
        card_url: input.card_url || null,
        seo_title: input.seo_title || null,
        seo_description: input.seo_description || null,
        show_remaining: input.show_remaining ?? false,
        featured: input.featured ?? false,
        sort_order: input.sort_order ?? 0,
      });
      created.push({ table: 'events', filter: `id=eq.${event.id}` });

      // 2. INSERT ticket_zones
      const createdZones: { id: string; total_capacity: number; zone_type: string }[] = [];
      for (const z of input.zones) {
        const zone = await supaInsert<{ id: string; total_capacity: number }>('ticket_zones', {
          event_id: event.id,
          zone_name: z.zone_name,
          zone_type: z.zone_type,
          price: z.price,
          original_price: z.original_price || null,
          total_capacity: z.total_capacity,
          available: z.total_capacity,
          sold: 0,
          color: z.color || '#cf1726',
          has_2x1: z.has_2x1 ?? false,
        });
        createdZones.push({ ...zone, zone_type: z.zone_type, total_capacity: z.total_capacity });
        created.push({ table: 'ticket_zones', filter: `id=eq.${zone.id}` });
      }

      // 3. INSERT schedules
      const createdSchedules: { id: string }[] = [];
      for (const s of input.schedules) {
        const schedCapacity = s.total_capacity || totalCapacity;
        const sched = await supaInsert<{ id: string }>('schedules', {
          event_id: event.id,
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time || null,
          total_capacity: schedCapacity,
          sold_capacity: 0,
          reserved_capacity: 0,
          staff_pin: s.staff_pin,
          staff_phone: s.staff_phone || null,
          staff_email: s.staff_email || null,
          status: 'active',
        });
        createdSchedules.push(sched);
        created.push({ table: 'schedules', filter: `id=eq.${sched.id}` });
      }

      // 4. INSERT schedule_inventory (N schedules × M zones)
      for (const sched of createdSchedules) {
        for (const zone of createdZones) {
          const inv = await supaInsert<{ id: string }>('schedule_inventory', {
            schedule_id: sched.id,
            zone_id: zone.id,
            available: zone.total_capacity,
            sold: 0,
            reserved: 0,
          });
          created.push({ table: 'schedule_inventory', filter: `id=eq.${inv.id}` });
        }
      }

      // 5. INSERT event_commissions
      const comm = await supaInsert<{ id: string }>('event_commissions', {
        event_id: event.id,
        commission_rate: input.commission_rate ?? 0.15,
      });
      created.push({ table: 'event_commissions', filter: `event_id=eq.${event.id}` });

      // Success summary
      return NextResponse.json({
        success: true,
        event_id: event.id,
        slug: input.slug,
        summary: {
          zones: createdZones.length,
          schedules: createdSchedules.length,
          inventory_rows: createdSchedules.length * createdZones.length,
          commission: input.commission_rate,
          status: input.status,
        },
      });

    } catch (insertError: any) {
      // ─── ROLLBACK: delete in reverse order ───
      console.error('Event creation failed, rolling back:', insertError.message);
      for (let i = created.length - 1; i >= 0; i--) {
        try {
          await supaDelete(created[i].table, created[i].filter);
        } catch (rollbackErr) {
          console.error(`Rollback failed for ${created[i].table}:`, rollbackErr);
        }
      }
      return NextResponse.json({ error: `Error creando evento: ${insertError.message}` }, { status: 500 });
    }

  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error inesperado' }, { status: 500 });
  }
}
