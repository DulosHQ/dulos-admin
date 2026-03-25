'use server';

import { eventSchema, type EventFormData } from '@/lib/validations/events.schema';
import { logAction } from './audit.actions';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

export async function getEvents() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/events?order=dates.desc`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Error al cargar eventos' };
  }
}

export async function createEvent(formData: EventFormData) {
  const parsed = eventSchema.safeParse(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      fieldErrors[issue.path[0] as string] = issue.message;
    });
    return { success: false, error: 'Datos inválidos', fieldErrors };
  }

  try {
    const body: Record<string, unknown> = {
      name: parsed.data.name,
      slug: parsed.data.slug,
      status: parsed.data.status,
      image_url: parsed.data.image_url || '',
      description: parsed.data.description || '',
      long_description: parsed.data.long_description || '',
      venue_id: parsed.data.venue_id || null,
      event_type: parsed.data.event_type || 'single',
      category: parsed.data.category || 'teatro',
      start_date: parsed.data.start_date || null,
      end_date: parsed.data.end_date || null,
      price_from: parsed.data.price_from ?? 0,
      original_price: parsed.data.original_price ?? 0,
      featured: parsed.data.featured ?? false,
      show_remaining: parsed.data.show_remaining ?? false,
      seo_title: parsed.data.seo_title || '',
      seo_description: parsed.data.seo_description || '',
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error creating event: ${res.status} ${errText}`);
    }
    const data = await res.json();
    logAction('create', 'event', data[0]?.id || '', JSON.stringify({ name: parsed.data.name, slug: parsed.data.slug }));
    return { success: true, data: data[0] };
  } catch (error) {
    console.error('createEvent error:', error);
    return { success: false, error: 'Error al crear el evento' };
  }
}

export async function updateEvent(id: string, formData: Partial<EventFormData>) {
  try {
    // Only send fields that are present
    const body: Record<string, unknown> = {};
    if (formData.name !== undefined) body.name = formData.name;
    if (formData.slug !== undefined) body.slug = formData.slug;
    if (formData.status !== undefined) body.status = formData.status;
    if (formData.image_url !== undefined) body.image_url = formData.image_url;
    if (formData.description !== undefined) body.description = formData.description;
    if (formData.long_description !== undefined) body.long_description = formData.long_description;
    if (formData.venue_id !== undefined) body.venue_id = formData.venue_id || null;
    if (formData.event_type !== undefined) body.event_type = formData.event_type;
    if (formData.category !== undefined) body.category = formData.category;
    if (formData.start_date !== undefined) body.start_date = formData.start_date;
    if (formData.end_date !== undefined) body.end_date = formData.end_date;
    if (formData.price_from !== undefined) body.price_from = formData.price_from;
    if (formData.original_price !== undefined) body.original_price = formData.original_price;
    if (formData.featured !== undefined) body.featured = formData.featured;
    if (formData.show_remaining !== undefined) body.show_remaining = formData.show_remaining;
    if (formData.seo_title !== undefined) body.seo_title = formData.seo_title;
    if (formData.seo_description !== undefined) body.seo_description = formData.seo_description;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    logAction('update', 'event', id, JSON.stringify(body));
    return { success: true, data: data[0] };
  } catch (error) {
    return { success: false, error: 'Error al actualizar el evento' };
  }
}

export async function archiveEvent(id: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/events?id=eq.${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'archived' }),
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    logAction('delete', 'event', id, 'Evento archivado');
    return { success: true, data: data[0] };
  } catch (error) {
    return { success: false, error: 'Error al archivar el evento' };
  }
}
