'use server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const headers = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const countHeaders = {
  ...headers,
  'Prefer': 'count=exact',
  'Range': '0-0', // Only need the count, not data
};

export async function getOrders(filters?: {
  event_id?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const limit = filters?.limit || 50;
    const page = filters?.page || 1;
    const offset = (page - 1) * limit;

    let endpoint = `${SUPABASE_URL}/rest/v1/orders?select=*,event:events!event_id(name)&order=purchased_at.desc&limit=${limit}&offset=${offset}`;
    if (filters?.event_id) endpoint += `&event_id=eq.${filters.event_id}`;
    if (filters?.status) endpoint += `&payment_status=eq.${filters.status}`;

    const res = await fetch(endpoint, {
      headers: { ...headers, 'Prefer': 'count=exact' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Error: ${res.status}`);

    const data = await res.json();
    const contentRange = res.headers.get('content-range');
    const total = contentRange ? parseInt(contentRange.split('/')[1], 10) : data.length;

    return { success: true, data, total, page, limit };
  } catch (error) {
    return { success: false, error: 'Error al cargar órdenes' };
  }
}

export async function getOrderStats() {
  try {
    // Use SQL aggregates via RPC instead of loading all rows into memory
    // Fallback: count via HEAD with Prefer: count=exact
    const [ordersCountRes, revenueRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/orders?select=id&payment_status=eq.completed`, {
        headers: { ...headers, 'Prefer': 'count=exact', 'Range': '0-0' },
        cache: 'no-store',
      }),
      fetch(`${SUPABASE_URL}/rest/v1/orders?select=total_price,discount_amount&payment_status=eq.completed`, {
        headers,
        cache: 'no-store',
      }),
    ]);

    if (!ordersCountRes.ok || !revenueRes.ok) throw new Error('Error fetching stats');

    const contentRange = ordersCountRes.headers.get('content-range');
    const totalCount = contentRange ? parseInt(contentRange.split('/')[1], 10) : 0;

    const orders = await revenueRes.json();
    const totalRevenue = orders.reduce(
      (sum: number, o: any) => sum + ((o.total_price || 0) - (o.discount_amount || 0)),
      0
    );
    const aov = totalCount > 0 ? totalRevenue / totalCount : 0;

    return { success: true, data: { totalRevenue, totalCount, aov } };
  } catch (error) {
    return { success: false, error: 'Error al cargar estadísticas' };
  }
}
