import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

export type TierInfo = {
  tier: "free" | "pro"
  proUntil: string | null
  isPro: boolean
}

export async function getUserTier(userId: string): Promise<TierInfo> {
  // DEV-ONLY: bypass tier check while Dodo verification is pending.
  // Physically impossible in production — the NODE_ENV guard is checked at
  // runtime, and Vercel production deploys set NODE_ENV=production.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_BYPASS_PRO === "true"
  ) {
    return { tier: "pro", proUntil: null, isPro: true }
  }

  const supabase = createAdminClient()
  const { data } = await supabase
    .from("user")
    .select("tier, pro_until")
    .eq("id", userId)
    .single()

  if (!data) return { tier: "free", proUntil: null, isPro: false }

  const tier = (data.tier as "free" | "pro") ?? "free"
  const proUntil = (data.pro_until as string | null) ?? null
  const isPro =
    tier === "pro" && (proUntil === null || new Date(proUntil) > new Date())

  return { tier, proUntil, isPro }
}
