import "server-only"
import { z } from "zod"

// Importing this module evaluates the env at import time. In production any
// missing required key throws. In development/test the relaxed schema is used
// so unrelated tests don't need the full secret set; consumers must handle
// undefined for the optional-in-dev keys.

// To add a new env var:
//   1. Add a field to baseShape below.
//   2. Add it to .env.example (under the right phase section).
//   3. If required in production (no .default(), no .optional()), add a test
//      in tests/env.test.ts covering the missing-in-production case.

const baseShape = {
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
} as const

const prodSchema = z.object(baseShape)
const devSchema = z.object({
  ...baseShape,
  OPENAI_API_KEY: baseShape.OPENAI_API_KEY.optional(),
  DODO_PAYMENTS_API_KEY: baseShape.DODO_PAYMENTS_API_KEY.optional(),
  DODO_PAYMENTS_WEBHOOK_SECRET: baseShape.DODO_PAYMENTS_WEBHOOK_SECRET.optional(),
  DODO_PRO_PRODUCT_ID: baseShape.DODO_PRO_PRODUCT_ID.optional(),
  NEXT_PUBLIC_APP_URL: baseShape.NEXT_PUBLIC_APP_URL.optional(),
})

const isProd = process.env.NODE_ENV === "production"

const parsed = isProd
  ? prodSchema.safeParse(process.env)
  : devSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ")
  if (isProd) {
    throw new Error(`Invalid environment configuration: ${issues}`)
  }
  console.warn(`[lib/env] ${issues}`)
}

// Canonical export type is the relaxed dev schema: required-in-prod keys are
// typed as string | undefined so consumers must handle the dev/test case where
// they are absent. In production the runtime guard above guarantees they are
// present, but the type stays honest about the dev branch.
type Env = z.infer<typeof devSchema>

export const env: Env = parsed.success
  ? (parsed.data as Env)
  : devSchema.parse({})
