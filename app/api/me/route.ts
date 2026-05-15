import "server-only"
import { auth } from "@/lib/auth"
import { getUserTier } from "@/lib/billing/tier"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.id) {
    return Response.json({ signedIn: false }, { status: 200 })
  }
  const tier = await getUserTier(session.user.id)
  return Response.json({
    signedIn: true,
    userId: session.user.id,
    tier: tier.tier,
    isPro: tier.isPro,
    proUntil: tier.proUntil,
  })
}
