import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import type { QuotaKind } from "@/lib/billing/plans"

export type UsageRecord = {
  userId: string
  kind: QuotaKind
  model: string
  inputTokens: number
  outputTokens: number
  ms: number
}

export async function recordUsage(rec: UsageRecord): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from("ai_usage").insert({
    user_id: rec.userId,
    kind: rec.kind,
    model: rec.model,
    input_tokens: rec.inputTokens,
    output_tokens: rec.outputTokens,
    ms: rec.ms,
  })
  if (error) console.error("recordUsage failed", { requestId: rec.userId.slice(0, 8) })
}

function startOfMonthIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

export async function monthUsage(userId: string, kind: QuotaKind): Promise<number> {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("created_at", startOfMonthIso())
  return count ?? 0
}
