import { describe, expect, it, beforeEach } from "vitest"

describe("lib/env", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY
    delete process.env.DODO_PAYMENTS_API_KEY
    delete process.env.DODO_PAYMENTS_WEBHOOK_SECRET
    delete process.env.DODO_PRO_PRODUCT_ID
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.NEXT_PUBLIC_DODO_PAYMENTS_ENVIRONMENT
    process.env.NODE_ENV = "test"
  })

  it("throws when OPENAI_API_KEY is missing in production", async () => {
    process.env.NODE_ENV = "production"
    await expect(import("@/lib/env?case=missing-openai")).rejects.toThrow(
      /OPENAI_API_KEY/,
    )
  })

  it("returns parsed env when all required vars are present", async () => {
    process.env.NODE_ENV = "production"
    process.env.OPENAI_API_KEY = "sk-test"
    process.env.DODO_PAYMENTS_API_KEY = "dodo_test"
    process.env.DODO_PAYMENTS_WEBHOOK_SECRET = "whsec_test"
    process.env.DODO_PRO_PRODUCT_ID = "pdt_test"
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000"
    const { env } = await import("@/lib/env?case=ok")
    expect(env.OPENAI_API_KEY).toBe("sk-test")
  })

  it("throws in production when NEXT_PUBLIC_APP_URL is malformed", async () => {
    process.env.NODE_ENV = "production"
    process.env.OPENAI_API_KEY = "sk-test"
    process.env.DODO_PAYMENTS_API_KEY = "dodo_test"
    process.env.DODO_PAYMENTS_WEBHOOK_SECRET = "whsec_test"
    process.env.DODO_PRO_PRODUCT_ID = "pdt_test"
    process.env.NEXT_PUBLIC_APP_URL = "not-a-url"
    await expect(import("@/lib/env?case=bad-url")).rejects.toThrow(/NEXT_PUBLIC_APP_URL/)
  })

  it("imports successfully in development with no secrets and applies defaults", async () => {
    process.env.NODE_ENV = "development"
    const mod = await import("@/lib/env?case=dev-empty")
    expect(mod.env.NEXT_PUBLIC_DODO_PAYMENTS_ENVIRONMENT).toBe("test_mode")
    expect(mod.env.OPENAI_API_KEY).toBeUndefined()
  })
})
