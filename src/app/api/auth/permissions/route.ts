import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { normalizeRole, ROLE_PERMISSIONS } from '@/lib/roles';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const FOUNDER_EMAILS = ['angel.lopez@vulkn-ai.com', 'tamaravulkn@gmail.com', 'paolo@dulos.io', 'juan.sotelo@dulos.io'];

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // no-op in route
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = user.email.toLowerCase();

    if (FOUNDER_EMAILS.includes(email)) {
      return NextResponse.json({
        email,
        name: user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0],
        role: 'ADMIN',
        permissions: ROLE_PERMISSIONS.ADMIN,
      });
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/team_members?email=eq.${encodeURIComponent(email)}&is_active=eq.true&select=email,name,role&limit=1`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return NextResponse.json({ error: `Team lookup failed: ${res.status} ${body}` }, { status: 500 });
    }

    const members = await res.json();
    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const member = members[0];
    const role = normalizeRole(member.role);

    return NextResponse.json({
      email,
      name: member.name || email.split('@')[0],
      role,
      permissions: ROLE_PERMISSIONS[role] || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
