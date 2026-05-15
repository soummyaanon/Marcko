import { describe, expect, it, vi } from "vitest"

const mockSingle = vi.fn()
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single: mockSingle }),
      }),
    }),
  }),
}))

describe("getUserTier", () => {
  it("returns isPro=true when tier=pro and pro_until is null", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { tier: "pro", pro_until: null },
      error: null,
    })
    const { getUserTier } = await import("@/lib/billing/tier")
    const result = await getUserTier("user-1")
    expect(result).toEqual({ tier: "pro", proUntil: null, isPro: true })
  })

  it("returns isPro=true when pro_until is in the future", async () => {
    const future = new Date(Date.now() + 86400_000).toISOString()
    mockSingle.mockResolvedValueOnce({
      data: { tier: "pro", pro_until: future },
      error: null,
    })
    const { getUserTier } = await import("@/lib/billing/tier")
    const result = await getUserTier("user-2")
    expect(result.isPro).toBe(true)
  })

  it("returns isPro=false when pro_until is in the past", async () => {
    const past = new Date(Date.now() - 86400_000).toISOString()
    mockSingle.mockResolvedValueOnce({
      data: { tier: "pro", pro_until: past },
      error: null,
    })
    const { getUserTier } = await import("@/lib/billing/tier")
    const result = await getUserTier("user-3")
    expect(result.isPro).toBe(false)
  })

  it("defaults to free when row missing", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null })
    const { getUserTier } = await import("@/lib/billing/tier")
    const result = await getUserTier("user-4")
    expect(result).toEqual({ tier: "free", proUntil: null, isPro: false })
  })
})
