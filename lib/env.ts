import "server-only"
import { z } from "zod"

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  DODO_PAYMENTS_API_KEY: z.string().min(1, "DODO_PAYMENTS_API_KEY is required"),
  DODO_PAYMENTS_WEBHOOK_SECRET: z
    .string()
    .min(1, "DODO_PAYMENTS_WEBHOOK_SECRET is required"),
  DODO_PRO_PRODUCT_ID: z.string().min(1, "DODO_PRO_PRODUCT_ID is required"),
  NEXT_PUBLIC_DODO_PAYMENTS_ENVIRONMENT: z
    .enum(["test_mode", "live_mode"])
    .default("test_mode"),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a URL"),
})

const isProd = process.env.NODE_ENV === "production"

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  if (isProd) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")
    throw new Error(`Invalid environment configuration: ${issues}`)
  }
  // In dev/test we let it parse with defaults so unit tests for unrelated
  // modules don't need the full secret set.
}

export const env = (parsed.success ? parsed.data : (process.env as unknown as z.infer<typeof schema>))
