import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase REST proxy with RBAC table whitelist.
 * 
 * Client pages call this instead of Supabase directly, so the service role key
 * stays server-side and never leaks to the browser.
 * 
 * Auth: requires valid Supabase Auth session (verified via getUser()).
 * The team_members check is already done by middleware.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Table access whitelist — only these tables can be accessed via proxy
// 'read' = GET only, 'write' = GET + POST/PATCH, 'full' = GET + POST/PATCH/DELETE
const TABLE_ACL: Record<string, 'read' | 'write' | 'full'> = {
  // Core business data
  events: 'write',
  schedules: 'write',
  venues: 'write',
  orders: 'read',
  tickets: 'read',
  customers: 'read',
  
  // Ticketing
  ticket_zones: 'write',
  zone_sections: 'write',
  venue_sections: 'write',
  venue_seats: 'read',
  event_section_seats: 'write',
  event_sections: 'write',
  schedule_inventory: 'read',
  
  // Financial
  event_commissions: 'write',
  dispersions: 'write',
  
  // Marketing
  coupons: 'write',
  abandoned_carts: 'read',
  event_reviews: 'write',
  
  // Ops
  audit_logs: 'read',
  team_members: 'read',
  escalations: 'read',
};

function isTableAllowed(table: string, method: string): boolean {
  // Extract base table name (path might include "?..." or "select=...")
  const baseName = table.split('?')[0].split('!')[0];
  const acl = TABLE_ACL[baseName];
  if (!acl) return false;

  if (method === 'GET') return true; // All whitelisted tables allow read
  if (method === 'DELETE') return acl === 'full';
  return acl === 'write' || acl === 'full'; // POST/PATCH need write or full
}

async function getAuthUser(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const path = request.nextUrl.searchParams.get('path');
    if (!path) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    // RBAC check
    if (!isTableAllowed(path, 'GET')) {
      console.warn(`[Proxy RBAC] Blocked GET on '${path}' for user ${user.email}`);
      return NextResponse.json({ error: 'Table access denied' }, { status: 403 });
    }

    const params = new URLSearchParams();
    request.nextUrl.searchParams.forEach((value, key) => {
      if (key !== 'path') {
        params.set(key, value);
      }
    });

    const queryString = params.toString();
    const supabaseUrl = `${SUPABASE_URL}/rest/v1/${path}${queryString ? '?' + queryString : ''}`;

    const preferHeader = request.headers.get('Prefer') || '';
    const headers: Record<string, string> = {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    };
    if (preferHeader) headers['Prefer'] = preferHeader;

    const response = await fetch(supabaseUrl, { headers, cache: 'no-store' });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase proxy error:', response.status, errorText);
      return NextResponse.json(
        { error: `Supabase error: ${response.status}`, detail: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const contentRange = response.headers.get('content-range');
    const responseHeaders: Record<string, string> = {};
    if (contentRange) responseHeaders['content-range'] = contentRange;

    return NextResponse.json(data, { headers: responseHeaders });
  } catch (error: any) {
    console.error('Supabase proxy error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { method, path, query, payload } = body as {
      method: 'POST' | 'PATCH' | 'DELETE';
      path: string;
      query?: string;
      payload?: any;
    };

    if (!path || !method) {
      return NextResponse.json({ error: 'Missing path or method' }, { status: 400 });
    }

    // RBAC check
    if (!isTableAllowed(path, method)) {
      console.warn(`[Proxy RBAC] Blocked ${method} on '${path}' for user ${user.email}`);
      return NextResponse.json({ error: 'Table access denied' }, { status: 403 });
    }

    const supabaseUrl = `${SUPABASE_URL}/rest/v1/${path}${query ? '?' + query : ''}`;

    const headers: Record<string, string> = {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };

    const response = await fetch(supabaseUrl, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase proxy mutation error:', response.status, errorText);
      return NextResponse.json(
        { error: `Supabase error: ${response.status}`, detail: errorText },
        { status: response.status }
      );
    }

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Supabase proxy mutation error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
