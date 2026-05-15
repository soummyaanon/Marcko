import "server-only"
import { auth } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { createCheckoutSession } from "@/lib/billing/dodo"
import { checkBurst } from "@/lib/ai/rate-limit"

export const runtime = "nodejs"

export async function POST(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.id || !session.user.email) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  // NOTE: ai_rate_buckets.user_id has an FK to public."user"(id), so a
  // prefixed key like "checkout:<uid>" would fail FK validation. We share
  // the AI burst bucket here (same 10/10s budget) — legitimate users will
  // not hit checkout often enough for this to collide meaningfully.
  const burst = await checkBurst(session.user.id)
  if (!burst.allowed) {
    return Response.json({ error: "rate_limited" }, { status: 429 })
  }

  const supabase = createAdminClient()
  const { data: row } = await supabase
    .from("user")
    .select("dodo_customer_id")
    .eq("id", session.user.id)
    .single()

  try {
    const { checkoutUrl, customerId } = await createCheckoutSession({
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name ?? undefined,
      existingCustomerId: (row?.dodo_customer_id as string | null) ?? null,
    })

    if (!row?.dodo_customer_id) {
      await supabase
        .from("user")
        .update({ dodo_customer_id: customerId })
        .eq("id", session.user.id)
    }

    return Response.json({ checkoutUrl })
  } catch (err) {
    console.error("checkout failed", { userId: session.user.id })
    return Response.json({ error: "checkout_failed" }, { status: 502 })
  }
}
