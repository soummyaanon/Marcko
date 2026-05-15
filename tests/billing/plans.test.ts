import { describe, expect, it } from "vitest"
import { PRO_MONTHLY_QUOTAS, FREE_MONTHLY_QUOTAS, QuotaKind } from "@/lib/billing/plans"

describe("plans", () => {
  it("defines a Pro inline_edit limit higher than Free", () => {
    expect(PRO_MONTHLY_QUOTAS.inline_edit).toBeGreaterThan(
      FREE_MONTHLY_QUOTAS.inline_edit,
    )
  })

  it("has matching keys for Free and Pro", () => {
    expect(Object.keys(FREE_MONTHLY_QUOTAS).sort()).toEqual(
      Object.keys(PRO_MONTHLY_QUOTAS).sort(),
    )
  })

  it("QuotaKind union covers all configured kinds", () => {
    const kinds: QuotaKind[] = ["inline_edit"]
    for (const k of kinds) expect(PRO_MONTHLY_QUOTAS[k]).toBeDefined()
  })
})
