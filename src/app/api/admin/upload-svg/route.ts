import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    // Auth check via session
    const cookieStore = await cookies();
    const authClient = createServerClient(
      SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );
    const { data: { session } } = await authClient.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const venueSlug = formData.get('venueSlug') as string;

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });
    if (!file.name.endsWith('.svg')) {
      return NextResponse.json({ error: 'Only SVG files allowed' }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const fileName = venueSlug
      ? `${venueSlug}.svg`
      : `${file.name.replace(/\.svg$/, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase()}.svg`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { data, error } = await supabase.storage
      .from('venue-layouts')
      .upload(fileName, buffer, {
        contentType: 'image/svg+xml',
        upsert: true,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('venue-layouts')
      .getPublicUrl(fileName);

    // Parse SVG for data-zone names
    const svgText = buffer.toString('utf-8');
    const zoneNames: string[] = [];
    const regex = /data-zone="([^"]+)"/g;
    let match;
    while ((match = regex.exec(svgText)) !== null) {
      zoneNames.push(match[1]);
    }

    return NextResponse.json({
      url: urlData.publicUrl,
      path: data.path,
      zones: zoneNames,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
