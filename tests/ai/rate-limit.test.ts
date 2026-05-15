import { describe, expect, it, vi } from "vitest"

let row: { window_start: string; tokens: number } | null = null
const updateMock = vi.fn(async (patch: { window_start: string; tokens: number }) => {
  row = patch as never
  return { error: null }
})
const upsertMock = vi.fn(async (patch: { user_id: string; window_start: string; tokens: number }) => {
  row = { window_start: patch.window_start, tokens: patch.tokens }
  return { error: null }
})

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
      upsert: upsertMock,
      update: () => ({ eq: updateMock }),
    }),
  }),
}))

describe("checkBurst", () => {
  it("allows the first request and increments the bucket", async () => {
    row = null
    const { checkBurst } = await import("@/lib/ai/rate-limit")
    const ok = await checkBurst("u1")
    expect(ok.allowed).toBe(true)
    expect(upsertMock).toHaveBeenCalled()
  })

  it("rejects when over the limit within the window", async () => {
    row = { window_start: new Date().toISOString(), tokens: 10 }
    const { checkBurst } = await import("@/lib/ai/rate-limit")
    const ok = await checkBurst("u1")
    expect(ok.allowed).toBe(false)
  })

  it("resets the window when stale", async () => {
    row = {
      window_start: new Date(Date.now() - 30_000).toISOString(),
      tokens: 10,
    }
    const { checkBurst } = await import("@/lib/ai/rate-limit")
    const ok = await checkBurst("u1")
    expect(ok.allowed).toBe(true)
  })
})
