import "server-only"
import { auth } from "@/lib/auth"
import { getUserTier } from "@/lib/billing/tier"
import { monthUsage } from "@/lib/ai/usage"
import { checkBurst } from "@/lib/ai/rate-limit"
import {
  FREE_MONTHLY_QUOTAS,
  PRO_MONTHLY_QUOTAS,
  type QuotaKind,
} from "@/lib/billing/plans"

export type AuthedContext = {
  userId: string
  tier: "free" | "pro"
  isPro: boolean
}

export type AuthedHandler = (
  req: Request,
  ctx: AuthedContext,
) => Promise<Response>

export function withProGate(inner: AuthedHandler) {
  return async (req: Request): Promise<Response> => {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user?.id) {
      return Response.json({ error: "unauthorized" }, { status: 401 })
    }
    const { tier, isPro } = await getUserTier(session.user.id)
    if (!isPro) {
      return Response.json(
        { error: "pro_required", upgradeUrl: "/pricing" },
        { status: 402 },
      )
    }
    return inner(req, { userId: session.user.id, tier, isPro })
  }
}

export function withQuota(kind: QuotaKind, inner: AuthedHandler): AuthedHandler {
  return async (req, ctx) => {
    const burst = await checkBurst(ctx.userId)
    if (!burst.allowed) {
      return Response.json(
        { error: "rate_limited", retryAfterMs: burst.retryAfterMs },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(burst.retryAfterMs / 1000)),
          },
        },
      )
    }
    const limit = (ctx.isPro ? PRO_MONTHLY_QUOTAS : FREE_MONTHLY_QUOTAS)[kind]
    const used = await monthUsage(ctx.userId, kind)
    if (used >= limit) {
      return Response.json(
        {
          error: "quota_exceeded",
          kind,
          used,
          limit,
          resetsAt: nextMonthStart(),
        },
        { status: 429 },
      )
    }
    return inner(req, ctx)
  }
}

function nextMonthStart(): string {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  ).toISOString()
}
