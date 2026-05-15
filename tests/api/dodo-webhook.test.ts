import { describe, expect, it, vi } from "vitest"
import crypto from "node:crypto"

const insertEventMock = vi.fn()
const rpcMock = vi.fn()
const resolveUserMock = vi.fn()

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: insertEventMock,
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: resolveUserMock(), error: null }) }),
      }),
    }),
    rpc: rpcMock,
  }),
}))

vi.mock("@/lib/env", () => ({
  env: {
    DODO_PAYMENTS_WEBHOOK_SECRET: "whsec_test_secret",
    NEXT_PUBLIC_DODO_PAYMENTS_ENVIRONMENT: "test_mode",
  },
}))

const secret = "whsec_test_secret"
function header(payload: string): { sig: string; ts: string } {
  const ts = String(Math.floor(Date.now() / 1000))
  const sig = crypto.createHmac("sha256", secret).update(`${ts}.${payload}`).digest("base64")
  return { sig: `t=${ts},v1=${sig}`, ts }
}

describe("POST /api/billing/dodo/webhook", () => {
  it("rejects bad signature with 400", async () => {
    const { POST } = await import("@/app/api/billing/dodo/webhook/route")
    const payload = JSON.stringify({ id: "evt_1", type: "subscription.active", data: {} })
    const res = await POST(
      new Request("http://x/webhook", {
        method: "POST",
        body: payload,
        headers: { "webhook-signature": "garbage" },
      }),
    )
    expect(res.status).toBe(400)
    expect(insertEventMock).not.toHaveBeenCalled()
  })

  it("returns 200 and applies tier mutation for active subscription", async () => {
    insertEventMock.mockResolvedValueOnce({ error: null })
    rpcMock.mockResolvedValueOnce({ data: null, error: null })
    resolveUserMock.mockReturnValueOnce({ id: "user-1" })
    const { POST } = await import("@/app/api/billing/dodo/webhook/route")
    const payload = JSON.stringify({
      id: "evt_2",
      type: "subscription.active",
      data: {
        id: "sub_1",
        customer_id: "cus_1",
        current_period_end: "2099-01-01T00:00:00Z",
        metadata: { user_id: "user-1" },
      },
    })
    const h = header(payload)
    const res = await POST(
      new Request("http://x/webhook", {
        method: "POST",
        body: payload,
        headers: { "webhook-signature": h.sig },
      }),
    )
    expect(res.status).toBe(200)
    expect(rpcMock).toHaveBeenCalledWith(
      "apply_subscription_event",
      expect.objectContaining({
        p_user_id: "user-1",
        p_new_tier: "pro",
      }),
    )
  })

  it("is idempotent on duplicate event id", async () => {
    insertEventMock.mockResolvedValueOnce({
      error: { code: "23505" /* unique_violation */ },
    })
    const { POST } = await import("@/app/api/billing/dodo/webhook/route")
    const payload = JSON.stringify({
      id: "evt_2",
      type: "subscription.active",
      data: { id: "sub_1", customer_id: "cus_1", current_period_end: "2099-01-01T00:00:00Z" },
    })
    const h = header(payload)
    const res = await POST(
      new Request("http://x/webhook", {
        method: "POST",
        body: payload,
        headers: { "webhook-signature": h.sig },
      }),
    )
    expect(res.status).toBe(200)
  })

  it("acks 200 when apply_subscription_event raises no_data_found (unknown user)", async () => {
    insertEventMock.mockResolvedValueOnce({ error: null })
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "P0001", message: "user not found" }, // PG error
    })
    resolveUserMock.mockReturnValueOnce({ id: "ghost-user" })
    const { POST } = await import("@/app/api/billing/dodo/webhook/route")
    const payload = JSON.stringify({
      id: "evt_3",
      type: "subscription.active",
      data: {
        id: "sub_2",
        customer_id: "cus_2",
        current_period_end: "2099-01-01T00:00:00Z",
        metadata: { user_id: "ghost-user" },
      },
    })
    const h = header(payload)
    const res = await POST(
      new Request("http://x/webhook", {
        method: "POST",
        body: payload,
        headers: { "webhook-signature": h.sig },
      }),
    )
    // Should ack (200) so Dodo stops retrying for orphaned subscriptions.
    expect(res.status).toBe(200)
  })
})
