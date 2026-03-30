import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase REST proxy.
 * 
 * Client pages call this instead of Supabase directly, so the service role key
 * stays server-side and never leaks to the browser.
 * 
 * Usage: GET /api/supabase-proxy?path=orders&query=payment_status%3Deq.completed%26order%3Dpurchased_at.desc
 * 
 * Auth: requires valid Supabase Auth session (verified via cookie).
 * The team_members check is already done by middleware.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    // Verify user has a valid session (middleware already checks team_members)
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

    // getUser() validates the JWT against Supabase (unlike getSession which only reads it locally)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the Supabase REST path and query from params
    const path = request.nextUrl.searchParams.get('path');
    if (!path) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    // Build the Supabase REST URL
    // All other query params (except 'path') are forwarded to Supabase
    const params = new URLSearchParams();
    request.nextUrl.searchParams.forEach((value, key) => {
      if (key !== 'path') {
        params.set(key, value);
      }
    });

    const queryString = params.toString();
    const supabaseUrl = `${SUPABASE_URL}/rest/v1/${path}${queryString ? '?' + queryString : ''}`;

    // Forward headers that Supabase needs
    const preferHeader = request.headers.get('Prefer') || '';

    const headers: Record<string, string> = {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    };

    if (preferHeader) {
      headers['Prefer'] = preferHeader;
    }

    const response = await fetch(supabaseUrl, {
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase proxy error:', response.status, errorText);
      return NextResponse.json(
        { error: `Supabase error: ${response.status}`, detail: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Forward content-range header for paginated requests
    const contentRange = response.headers.get('content-range');
    const responseHeaders: Record<string, string> = {};
    if (contentRange) {
      responseHeaders['content-range'] = contentRange;
    }

    return NextResponse.json(data, { headers: responseHeaders });

  } catch (error: any) {
    console.error('Supabase proxy error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST for mutations (create dispersion, update, etc.)
export async function POST(request: NextRequest) {
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
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
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

    // Some DELETE/PATCH return empty body
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Supabase proxy mutation error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
