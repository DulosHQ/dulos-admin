'use server';

import { userInviteSchema, type UserInviteFormData } from '@/lib/validations/users.schema';
import { logAction } from './audit.actions';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

export async function getUsers() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_members?order=role`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Error al cargar usuarios' };
  }
}

export async function inviteUser(formData: UserInviteFormData) {
  const parsed = userInviteSchema.safeParse(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error.issues.forEach((issue) => {
      fieldErrors[issue.path[0] as string] = issue.message;
    });
    return { success: false, error: 'Datos inválidos', fieldErrors };
  }

  try {
    const body = {
      name: parsed.data.name || parsed.data.email.split('@')[0],
      email: parsed.data.email,
      role: parsed.data.role,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_members`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    logAction('create', 'user', data[0]?.id || '', JSON.stringify({ email: parsed.data.email, role: parsed.data.role }));
    return { success: true, data: data[0] };
  } catch (error) {
    return { success: false, error: 'Error al invitar usuario' };
  }
}

export async function updateUserRole(userId: string, role: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_members?id=eq.${userId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ role }),
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    logAction('update', 'user', userId, JSON.stringify({ role }));
    return { success: true, data: data[0] };
  } catch (error) {
    return { success: false, error: 'Error al actualizar rol' };
  }
}
