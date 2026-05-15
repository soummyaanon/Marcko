import { describe, expect, it, vi } from "vitest"

const getSessionMock = vi.fn()
const getUserTierMock = vi.fn()
const monthUsageMock = vi.fn()
const checkBurstMock = vi.fn()

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: getSessionMock } },
}))
vi.mock("@/lib/billing/tier", () => ({ getUserTier: getUserTierMock }))
vi.mock("@/lib/ai/usage", () => ({
  monthUsage: monthUsageMock,
  recordUsage: vi.fn(),
}))
vi.mock("@/lib/ai/rate-limit", () => ({ checkBurst: checkBurstMock }))

describe("withProGate", () => {
  it("returns 401 with no session", async () => {
    getSessionMock.mockResolvedValueOnce(null)
    const { withProGate } = await import("@/lib/ai/guards")
    const handler = withProGate(async () => new Response("ok"))
    const res = await handler(new Request("http://x", { method: "POST" }))
    expect(res.status).toBe(401)
  })

  it("returns 402 for free user", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "u1" } })
    getUserTierMock.mockResolvedValueOnce({ tier: "free", isPro: false, proUntil: null })
    const { withProGate } = await import("@/lib/ai/guards")
    const handler = withProGate(async () => new Response("ok"))
    const res = await handler(new Request("http://x", { method: "POST" }))
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.error).toBe("pro_required")
  })

  it("passes through for pro user", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "u1" } })
    getUserTierMock.mockResolvedValueOnce({ tier: "pro", isPro: true, proUntil: null })
    const { withProGate } = await import("@/lib/ai/guards")
    const handler = withProGate(async (req, ctx) => Response.json({ uid: ctx.userId }))
    const res = await handler(new Request("http://x", { method: "POST" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ uid: "u1" })
  })
})

describe("withQuota", () => {
  it("returns 429 when over the burst limit", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "u1" } })
    getUserTierMock.mockResolvedValueOnce({ tier: "pro", isPro: true, proUntil: null })
    checkBurstMock.mockResolvedValueOnce({ allowed: false, retryAfterMs: 5000 })
    const { withProGate, withQuota } = await import("@/lib/ai/guards")
    const handler = withProGate(withQuota("inline_edit", async () => new Response("ok")))
    const res = await handler(new Request("http://x", { method: "POST" }))
    expect(res.status).toBe(429)
  })

  it("returns 429 when over monthly quota", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "u1" } })
    getUserTierMock.mockResolvedValueOnce({ tier: "pro", isPro: true, proUntil: null })
    checkBurstMock.mockResolvedValueOnce({ allowed: true })
    monthUsageMock.mockResolvedValueOnce(500) // Pro inline_edit limit
    const { withProGate, withQuota } = await import("@/lib/ai/guards")
    const handler = withProGate(withQuota("inline_edit", async () => new Response("ok")))
    const res = await handler(new Request("http://x", { method: "POST" }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toBe("quota_exceeded")
  })

  it("passes through when under the quota", async () => {
    getSessionMock.mockResolvedValueOnce({ user: { id: "u1" } })
    getUserTierMock.mockResolvedValueOnce({ tier: "pro", isPro: true, proUntil: null })
    checkBurstMock.mockResolvedValueOnce({ allowed: true })
    monthUsageMock.mockResolvedValueOnce(10)
    const { withProGate, withQuota } = await import("@/lib/ai/guards")
    const handler = withProGate(withQuota("inline_edit", async () => new Response("ok")))
    const res = await handler(new Request("http://x", { method: "POST" }))
    expect(res.status).toBe(200)
  })
})
