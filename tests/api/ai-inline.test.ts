import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => ({ user: { id: "u1" } }) } },
}))
vi.mock("@/lib/billing/tier", () => ({
  getUserTier: async () => ({ tier: "pro", isPro: true, proUntil: null }),
}))
vi.mock("@/lib/ai/usage", () => ({
  monthUsage: async () => 0,
  recordUsage: vi.fn(),
}))
vi.mock("@/lib/ai/rate-limit", () => ({
  checkBurst: async () => ({ allowed: true }),
}))
vi.mock("@/lib/ai/openai", () => ({
  openai: (modelId: string) => ({ modelId }),
}))
vi.mock("ai", () => ({
  streamText: () => ({
    toUIMessageStreamResponse: () =>
      new Response("data: hello\n\n", {
        headers: { "content-type": "text/event-stream" },
      }),
  }),
}))

describe("POST /api/ai/inline", () => {
  it("rejects malformed body with 400", async () => {
    const { POST } = await import("@/app/api/ai/inline/route")
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ action: "not_a_real_action" }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it("streams a 200 SSE response for a valid rewrite", async () => {
    const { POST } = await import("@/app/api/ai/inline/route")
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({
          action: "rewrite",
          selection: "Hello world",
          context: "intro",
        }),
      }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/event-stream")
  })
})
