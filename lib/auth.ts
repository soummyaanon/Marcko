import "server-only"

import { dash, sentinel } from "@better-auth/infra"
import { Pool } from "pg"
import { betterAuth } from "better-auth"
import { getMigrations } from "better-auth/db"
import { nextCookies } from "better-auth/next-js"

const postgresUrlPattern = /^postgres(ql)?:\/\//i

const authDbUrl = [
  process.env.BETTER_AUTH_DATABASE_URL,
  process.env.POSTGRES_URL,
  process.env.SUPABASE_DB_URL,
  process.env.DATABASE_URL,
].find((candidate) => typeof candidate === "string" && postgresUrlPattern.test(candidate))

if (!authDbUrl) {
  throw new Error(
    "Missing Postgres auth DB URL. Set BETTER_AUTH_DATABASE_URL (or POSTGRES_URL / SUPABASE_DB_URL / DATABASE_URL).",
  )
}

const isSupabaseHost = (() => {
  try {
    return new URL(authDbUrl).hostname.includes("supabase.com")
  } catch {
    return false
  }
})()

const sslRejectUnauthorized =
  process.env.BETTER_AUTH_DB_SSL_REJECT_UNAUTHORIZED === "true"

const shouldUseSsl =
  process.env.BETTER_AUTH_DB_SSL === "true" ||
  authDbUrl.includes("sslmode=") ||
  isSupabaseHost

const sanitizeSslParamsFromConnectionString = (connectionString: string): string => {
  try {
    const parsed = new URL(connectionString)
    parsed.searchParams.delete("sslmode")
    parsed.searchParams.delete("sslcert")
    parsed.searchParams.delete("sslkey")
    parsed.searchParams.delete("sslrootcert")
    parsed.searchParams.delete("sslpassword")
    return parsed.toString()
  } catch {
    return connectionString
  }
}

const authPoolConnectionString = shouldUseSsl
  ? sanitizeSslParamsFromConnectionString(authDbUrl)
  : authDbUrl

export const authDbPool = new Pool({
  connectionString: authPoolConnectionString,
  ...(shouldUseSsl
    ? {
        // Normalize SSL in code so URL query params (e.g. sslmode=require) don't
        // override rejectUnauthorized behavior in pg.
        ssl: { rejectUnauthorized: sslRejectUnauthorized },
      }
    : {}),
})
const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET || "better-auth-secret-123456789",
  database: authDbPool,
  emailAndPassword: {
    enabled: false,
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            prompt: "select_account",
          },
        }
      : {},
  plugins: [nextCookies(), dash(), sentinel()],
})

let authMigrationsPromise: Promise<void> | null = null

const isAlreadyExistsError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false

  const maybeCode = "code" in error ? (error as { code?: unknown }).code : undefined
  if (maybeCode !== "42P07") return false

  // 42P07 is "duplicate_table"/"duplicate_relation" in Postgres.
  return true
}

export const ensureAuthSchema = async (): Promise<void> => {
  if (!authMigrationsPromise) {
    authMigrationsPromise = (async () => {
      const { runMigrations } = await getMigrations(auth.options)
      try {
        await runMigrations()
      } catch (error) {
        if (isAlreadyExistsError(error)) {
          return
        }

        throw error
      }
    })()
  }

  return authMigrationsPromise
}
