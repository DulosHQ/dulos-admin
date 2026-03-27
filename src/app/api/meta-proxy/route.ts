import { NextRequest, NextResponse } from 'next/server';

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || '';
const AD_ACCOUNT_ID = process.env.DULOS_AD_ACCOUNT_ID || 'act_1372745737889888';
const PAGE_ID = process.env.DULOS_PAGE_ID || '';
const PIXEL_ID = process.env.DULOS_PIXEL_ID || '2365592223939998';

/**
 * Generic Meta Graph API proxy for admin operations.
 * 
 * GET  /api/meta-proxy?endpoint=/act_xxx/campaigns&fields=name,status
 * POST /api/meta-proxy?endpoint=/act_xxx/ads  (body = JSON payload)
 * 
 * Auth: requires CRON_SECRET as ?secret= param (no Supabase session needed for agent use)
 */

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!META_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'META_ACCESS_TOKEN not configured' }, { status: 500 });
  }

  const endpoint = request.nextUrl.searchParams.get('endpoint') || '';
  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint param' }, { status: 400 });
  }

  // Forward all other params to Meta API
  const params = new URLSearchParams();
  request.nextUrl.searchParams.forEach((v, k) => {
    if (k !== 'secret' && k !== 'endpoint') params.set(k, v);
  });
  params.set('access_token', META_ACCESS_TOKEN);

  const url = `https://graph.facebook.com/v21.0${endpoint}?${params.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: data?.error?.message || 'Meta API error', detail: data }, { status: res.status });
  }

  // Inject known env values for reference
  return NextResponse.json({ ...data, _env: { AD_ACCOUNT_ID, PAGE_ID, PIXEL_ID } });
}

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!META_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'META_ACCESS_TOKEN not configured' }, { status: 500 });
  }

  const endpoint = request.nextUrl.searchParams.get('endpoint') || '';
  if (!endpoint) {
    return NextResponse.json({ error: 'Missing endpoint param' }, { status: 400 });
  }

  const body = await request.json();

  const url = `https://graph.facebook.com/v21.0${endpoint}`;
  const formData = new URLSearchParams();
  formData.set('access_token', META_ACCESS_TOKEN);
  
  // Flatten body into form params (Meta API uses form-encoded for most endpoints)
  for (const [k, v] of Object.entries(body)) {
    formData.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: data?.error?.message || 'Meta API error', detail: data }, { status: res.status });
  }

  return NextResponse.json(data);
}
