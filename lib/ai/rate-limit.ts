import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

const WINDOW_MS = 10_000
const BURST_LIMIT = 10

export type BurstResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number }

export async function checkBurst(userId: string): Promise<BurstResult> {
  const supabase = createAdminClient()
  const now = new Date()

  const { data: row } = await supabase
    .from("ai_rate_buckets")
    .select("window_start, tokens")
    .eq("user_id", userId)
    .maybeSingle()

  const windowStart = row ? new Date(row.window_start as string) : null
  const stale = !windowStart || now.getTime() - windowStart.getTime() >= WINDOW_MS

  if (stale) {
    await supabase.from("ai_rate_buckets").upsert({
      user_id: userId,
      window_start: now.toISOString(),
      tokens: 1,
    })
    return { allowed: true }
  }

  const tokens = (row?.tokens as number) ?? 0
  if (tokens >= BURST_LIMIT) {
    return {
      allowed: false,
      retryAfterMs: WINDOW_MS - (now.getTime() - windowStart!.getTime()),
    }
  }

  await supabase
    .from("ai_rate_buckets")
    .update({ window_start: windowStart!.toISOString(), tokens: tokens + 1 })
    .eq("user_id", userId)

  return { allowed: true }
}
