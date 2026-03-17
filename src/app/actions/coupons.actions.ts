'use server';

import { couponSchema, type CouponFormData } from '@/lib/validations/coupons.schema';
import { logAction } from './audit.actions';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

export async function getCoupons() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/coupons?order=created_at.desc`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Error al cargar cupones' };
  }
}

export async function createCoupon(formData: CouponFormData) {
  const parsed = couponSchema.safeParse(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      fieldErrors[issue.path[0] as string] = issue.message;
    });
    return { success: false, error: 'Datos inválidos', fieldErrors };
  }

  try {
    const body = {
      code: parsed.data.code,
      discount_type: parsed.data.discount_type,
      discount_value: parsed.data.discount_value,
      event_id: parsed.data.event_id || null,
      max_uses: parsed.data.max_uses || null,
      valid_until: parsed.data.valid_until || null,
      is_active: true,
      used_count: 0,
      created_at: new Date().toISOString(),
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/coupons`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    logAction('create', 'coupon', data[0]?.id || '', JSON.stringify({ code: parsed.data.code }));
    return { success: true, data: data[0] };
  } catch (error) {
    return { success: false, error: 'Error al crear el cupón' };
  }
}

export async function updateCoupon(id: string, formData: Partial<CouponFormData>) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/coupons?id=eq.${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(formData),
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    logAction('update', 'coupon', id, JSON.stringify(formData));
    return { success: true, data: data[0] };
  } catch (error) {
    return { success: false, error: 'Error al actualizar el cupón' };
  }
}

export async function deleteCoupon(id: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/coupons?id=eq.${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    logAction('delete', 'coupon', id, 'Cupón eliminado');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Error al eliminar el cupón' };
  }
}
