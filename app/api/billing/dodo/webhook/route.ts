import "server-only"
import { env } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  verifyDodoSignature,
  planFromEvent,
  type DodoEvent,
} from "@/lib/billing/webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function resolveUserIdByCustomer(
  customerId: string,
): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("user")
    .select("id")
    .eq("dodo_customer_id", customerId)
    .maybeSingle()
  return (data?.id as string | null) ?? null
}

export async function POST(req: Request): Promise<Response> {
  const secret = env.DODO_PAYMENTS_WEBHOOK_SECRET
  if (!secret) {
    console.error("webhook: DODO_PAYMENTS_WEBHOOK_SECRET not configured")
    return new Response("misconfigured", { status: 500 })
  }

  const raw = await req.text() // raw body BEFORE any parsing
  const sig = req.headers.get("webhook-signature")

  const ok = verifyDodoSignature({
    payload: raw,
    headerSignature: sig,
    secret,
  })
  if (!ok) {
    return new Response("bad signature", { status: 400 })
  }

  let event: DodoEvent & { id: string }
  try {
    event = JSON.parse(raw)
  } catch {
    return new Response("bad json", { status: 400 })
  }
  if (!event?.id || !event?.type) {
    return new Response("missing fields", { status: 400 })
  }

  const supabase = createAdminClient()
  const { error: insertErr } = await supabase
    .from("dodo_webhook_events")
    .insert({ id: event.id, type: event.type })

  if (insertErr) {
    if ((insertErr as { code?: string }).code === "23505") {
      return new Response(null, { status: 200 })
    }
    console.error("webhook idempotency insert failed", { eventId: event.id })
    return new Response("db error", { status: 500 })
  }

  const plan = await planFromEvent(event, resolveUserIdByCustomer, event.id)
  if (!plan) {
    return new Response(null, { status: 200 })
  }

  const { error: rpcErr } = await supabase.rpc("apply_subscription_event", {
    p_user_id: plan.userId,
    p_new_tier: plan.newTier,
    p_new_pro_until: plan.newProUntil,
    p_event_type: plan.eventType,
    p_dodo_event_id: plan.dodoEventId,
    p_raw: plan.raw,
  })
  if (rpcErr) {
    // Unknown-user errors raised by the SQL function (no_data_found) — ack and log.
    // Match permissively because PostgREST may surface the code in different ways.
    const errAny = rpcErr as { code?: string; message?: string }
    const looksLikeUnknownUser =
      errAny.code === "P0001" ||
      errAny.code === "02000" ||
      /does not exist|no_data_found/i.test(errAny.message ?? "")
    if (looksLikeUnknownUser) {
      console.warn("webhook for unknown user, acked", {
        eventId: event.id,
        userId: plan.userId,
      })
      return new Response(null, { status: 200 })
    }
    console.error("apply_subscription_event failed", { eventId: event.id })
    return new Response("apply failed", { status: 500 })
  }

  return new Response(null, { status: 200 })
}
