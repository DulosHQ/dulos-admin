import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = "https://udjwabtyhjcrpyuffavz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU5MzkzNCwiZXhwIjoyMDg5MTY5OTM0fQ.-1ABMJP5sYUyW1MDg2W7T8ZE3ipe5x_Lvmec9UdZkO8";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = body;

    // Log the webhook event
    await fetch(`${SUPABASE_URL}/rest/v1/dulos_audit_logs`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        user_email: "stripe-webhook",
        action: event.type || "webhook",
        entity_type: "stripe",
        entity_id: event.id || "",
        details: JSON.stringify(event).slice(0, 500),
      }),
    });

    // Handle specific events
    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      const data = event.data?.object;
      if (data) {
        await fetch(`${SUPABASE_URL}/rest/v1/dulos_orders`, {
          method: "POST",
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({
            order_number: `DUL-${Date.now()}`,
            customer_name: data.customer_details?.name || "Cliente",
            customer_email: data.customer_details?.email || "",
            total_price: (data.amount_total || data.amount || 0) / 100,
            payment_status: "completed",
            stripe_payment_id: data.payment_intent || data.id || "",
          }),
        });
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
