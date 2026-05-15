import "server-only"
import { auth } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { createPortalUrl } from "@/lib/billing/dodo"

export const runtime = "nodejs"

export async function POST(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }
  const supabase = createAdminClient()
  const { data } = await supabase
    .from("user")
    .select("dodo_customer_id")
    .eq("id", session.user.id)
    .single()
  const customerId = (data?.dodo_customer_id as string | null) ?? null
  if (!customerId) {
    return Response.json({ error: "no_customer" }, { status: 404 })
  }
  try {
    const url = await createPortalUrl(customerId)
    return Response.json({ url })
  } catch {
    return Response.json({ error: "portal_failed" }, { status: 502 })
  }
}
