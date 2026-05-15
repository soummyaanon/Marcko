import { describe, expect, it } from "vitest"
import crypto from "node:crypto"
import { verifyDodoSignature } from "@/lib/billing/webhook"

const secret = "whsec_test_secret"

function sign(payload: string, ts: string): string {
  return crypto.createHmac("sha256", secret).update(`${ts}.${payload}`).digest("base64")
}

describe("verifyDodoSignature", () => {
  it("accepts a fresh, valid signature", () => {
    const payload = '{"type":"subscription.active"}'
    const ts = String(Math.floor(Date.now() / 1000))
    const sig = sign(payload, ts)
    expect(
      verifyDodoSignature({ payload, headerSignature: `t=${ts},v1=${sig}`, secret }),
    ).toBe(true)
  })

  it("rejects a tampered payload", () => {
    const payload = '{"type":"subscription.active"}'
    const ts = String(Math.floor(Date.now() / 1000))
    const sig = sign(payload, ts)
    expect(
      verifyDodoSignature({
        payload: '{"type":"subscription.cancelled"}',
        headerSignature: `t=${ts},v1=${sig}`,
        secret,
      }),
    ).toBe(false)
  })

  it("rejects a signature older than 5 minutes (replay window)", () => {
    const payload = '{"type":"subscription.active"}'
    const ts = String(Math.floor(Date.now() / 1000) - 600)
    const sig = sign(payload, ts)
    expect(
      verifyDodoSignature({ payload, headerSignature: `t=${ts},v1=${sig}`, secret }),
    ).toBe(false)
  })

  it("rejects a malformed header", () => {
    expect(
      verifyDodoSignature({ payload: "x", headerSignature: "garbage", secret }),
    ).toBe(false)
  })
})
