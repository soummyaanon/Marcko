import { describe, expect, it, vi } from "vitest"

const insertMock = vi.fn()
const selectMock = vi.fn()

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: insertMock,
      select: selectMock,
    }),
  }),
}))

describe("recordUsage", () => {
  it("inserts a row with token + ms counts", async () => {
    insertMock.mockResolvedValueOnce({ data: null, error: null })
    const { recordUsage } = await import("@/lib/ai/usage")
    await recordUsage({
      userId: "u1",
      kind: "inline_edit",
      model: "gpt-5-mini",
      inputTokens: 12,
      outputTokens: 34,
      ms: 250,
    })
    expect(insertMock).toHaveBeenCalledWith({
      user_id: "u1",
      kind: "inline_edit",
      model: "gpt-5-mini",
      input_tokens: 12,
      output_tokens: 34,
      ms: 250,
    })
  })
})

describe("monthUsage", () => {
  it("counts rows in the current calendar month", async () => {
    selectMock.mockReturnValueOnce({
      eq: () => ({
        eq: () => ({
          gte: () => Promise.resolve({ count: 7, data: [], error: null }),
        }),
      }),
    })
    const { monthUsage } = await import("@/lib/ai/usage")
    const n = await monthUsage("u1", "inline_edit")
    expect(n).toBe(7)
  })
})
