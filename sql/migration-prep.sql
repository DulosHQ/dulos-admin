-- ================================================
-- DULOS ADMIN V2 — Migration Prep SQL
-- Run in Supabase SQL Editor
-- ================================================

-- 1. FIX: v_sales_summary to count refunds from orders
-- (Currently refunded column always returns 0)
CREATE OR REPLACE VIEW v_sales_summary AS
SELECT 
  e.id AS event_id,
  e.name AS event_name,
  v.name AS venue_name,
  COALESCE(COUNT(CASE WHEN o.payment_status = 'completed' THEN 1 END), 0) AS total_orders,
  COALESCE(SUM(CASE WHEN o.payment_status = 'completed' THEN o.quantity ELSE 0 END), 0) AS total_tickets_sold,
  COALESCE(SUM(CASE WHEN o.payment_status = 'completed' THEN o.total_price ELSE 0 END), 0) AS total_revenue,
  COALESCE(COUNT(DISTINCT CASE WHEN t.status = 'used' THEN t.id END), 0) AS checked_in,
  COALESCE(COUNT(CASE WHEN o.payment_status = 'refunded' THEN 1 END), 0) AS refunded
FROM events e
LEFT JOIN venues v ON e.venue_id = v.id
LEFT JOIN orders o ON o.event_id = e.id
LEFT JOIN tickets t ON t.event_id = e.id
GROUP BY e.id, e.name, v.name;

-- 2. FIX: DULOS50 coupon missing discount value
UPDATE coupons 
SET discount_amount = 50, updated_at = NOW() 
WHERE code = 'DULOS50' AND discount_amount IS NULL;

-- 3. CREATE: escalations table (used by Stripe webhook + Gestión)
CREATE TABLE IF NOT EXISTS escalations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT,
  reason TEXT NOT NULL,
  event_mentioned TEXT DEFAULT '',
  situation TEXT,
  action_required TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;

-- 4. CREATE: dispersions table (Comisiones tab)
CREATE TABLE IF NOT EXISTS dispersions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  producer_name TEXT,
  commission_percent NUMERIC DEFAULT 15,
  total_revenue NUMERIC DEFAULT 0,
  dulos_commission NUMERIC DEFAULT 0,
  producer_share NUMERIC DEFAULT 0,
  refunds NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  dispersed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE dispersions ENABLE ROW LEVEL SECURITY;

-- 5. CREATE: scanner_links table (QR scanner management)
CREATE TABLE IF NOT EXISTS scanner_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  schedule_id UUID,
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  label TEXT NOT NULL,
  scans_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE scanner_links ENABLE ROW LEVEL SECURITY;

-- 6. CREATE: notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  recipient_email TEXT,
  channel TEXT DEFAULT 'email',
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 7. CREATE: reminders table  
CREATE TABLE IF NOT EXISTS reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  type TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- 8. CREATE: surveys table
CREATE TABLE IF NOT EXISTS surveys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  customer_email TEXT,
  rating INTEGER,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;

-- ================================================
-- RLS Policies (service role bypasses, anon blocked)
-- ================================================
-- Since all dashboard access goes through service_role_key,
-- and the public site uses anon_key, we keep RLS enabled
-- but only allow service_role to manage these admin tables.
-- No additional policies needed — service_role bypasses RLS.
