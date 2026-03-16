import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const STRIPE_WEBHOOK_SECRET = "whsec_p5BUrQHnlhi6AMzmzl9kXvQaIslAwVff";
const SUPABASE_URL = "https://udjwabtyhjcrpyuffavz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkandhYnR5aGpjcnB5dWZmYXZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU5MzkzNCwiZXhwIjoyMDg5MTY5OTM0fQ.-1ABMJP5sYUyW1MDg2W7T8ZE3ipe5x_Lvmec9UdZkO8";

function verifyStripeSignature(payload: string, signature: string): boolean {
  try {
    const parts = signature.split(",");
    const timestamp = parts.find(p => p.startsWith("t="))?.split("=")[1];
    const sig = parts.find(p => p.startsWith("v1="))?.split("v1=")[1];
    if (!timestamp || !sig) return false;
    const expected = crypto.createHmac("sha256", STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${payload}`).digest("hex");
    return sig === expected;
  } catch { return false; }
}

async function supabasePost(table: string, data: Record<string, unknown>) {
  return fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(data),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature") || "";
    if (signature && !verifyStripeSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);
    const data = event.data?.object;

    // Log ALL webhook events
    await supabasePost("dulos_audit_logs", {
      user_email: "stripe-webhook",
      action: event.type,
      entity_type: "stripe",
      entity_id: event.id || "",
      details: `${event.type}: ${JSON.stringify(data || {}).slice(0, 400)}`,
    });

    switch (event.type) {
      // ✅ Pago completado
      case "checkout.session.completed": {
        if (data) {
          await supabasePost("dulos_orders", {
            order_number: `DUL-${Date.now()}`,
            customer_name: data.customer_details?.name || "Cliente",
            customer_email: data.customer_details?.email || "",
            customer_phone: data.customer_details?.phone || "",
            total_price: (data.amount_total || 0) / 100,
            payment_status: "completed",
            stripe_payment_id: data.payment_intent || data.id,
          });
        }
        break;
      }

      // ✅ Pago exitoso
      case "payment_intent.succeeded": {
        if (data) {
          await supabasePost("dulos_audit_logs", {
            user_email: "stripe",
            action: "Pago confirmado",
            entity_type: "payment",
            entity_id: data.id,
            details: `$${(data.amount || 0) / 100} MXN — ${data.receipt_email || ""}`,
          });
        }
        break;
      }

      // ❌ Pago fallido
      case "payment_intent.payment_failed": {
        if (data) {
          await supabasePost("dulos_escalations", {
            client_id: data.receipt_email || data.id,
            reason: "pago_fallido",
            event_mentioned: "",
            situation: `Pago fallido: ${data.last_payment_error?.message || "Error desconocido"} — $${(data.amount || 0) / 100} MXN`,
            action_required: "Contactar al cliente para reintentar pago",
            resolved: false,
          });
        }
        break;
      }

      // 🚨 Disputa/Chargeback
      case "charge.dispute.created": {
        if (data) {
          await supabasePost("dulos_escalations", {
            client_id: data.charge || data.id,
            reason: "disputa",
            event_mentioned: "",
            situation: `DISPUTA CREADA: $${(data.amount || 0) / 100} MXN — Razón: ${data.reason || "no especificada"}`,
            action_required: "URGENTE: Responder disputa en Stripe dentro de 7 días",
            resolved: false,
          });
        }
        break;
      }

      // 💰 Reembolso
      case "charge.refunded": {
        if (data) {
          await supabasePost("dulos_audit_logs", {
            user_email: "stripe",
            action: "Reembolso procesado",
            entity_type: "refund",
            entity_id: data.id,
            details: `Reembolso $${(data.amount_refunded || 0) / 100} MXN`,
          });
        }
        break;
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
