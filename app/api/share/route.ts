import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"

import { auth, authDbPool, ensureAuthSchema } from "@/lib/auth"

export const runtime = "nodejs"

const GUEST_COOKIE_NAME = "marcko_guest"
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365
const ABUSE_BUCKET_DAYS = Math.max(
  1,
  Number.parseInt(process.env.GUEST_SHARE_ABUSE_BUCKET_DAYS ?? "7", 10) || 7,
)

const encode = (value: string) => Buffer.from(value).toString("base64url")

const createGuestToken = (guestId: string, secret: string): string => {
  const signature = createHmac("sha256", secret).update(guestId).digest("base64url")
  return `${encode(guestId)}.${signature}`
}

const parseGuestToken = (token: string, secret: string): string | null => {
  const [encodedGuestId, signature] = token.split(".")
  if (!encodedGuestId || !signature) return null

  const guestId = Buffer.from(encodedGuestId, "base64url").toString()
  if (!guestId) return null

  const expectedSignature = createHmac("sha256", secret).update(guestId).digest("base64url")
  const provided = Buffer.from(signature)
  const expected = Buffer.from(expectedSignature)

  if (provided.length !== expected.length) return null
  if (!timingSafeEqual(provided, expected)) return null

  return guestId
}

const authRequiredResponse = () => {
  return NextResponse.json(
    {
      code: "AUTH_REQUIRED",
      authRequired: true,
      message: "Please sign in with Google to create more shares.",
    },
    { status: 403 },
  )
}

const buildShareUrl = (request: NextRequest, id: string) => {
  return `${request.nextUrl.origin}/share/${id}`
}

const getClientIp = (request: NextRequest): string => {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const firstHop = forwardedFor.split(",")[0]?.trim()
    if (firstHop) return firstHop
  }

  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp

  return "unknown"
}

const getIpPrefix = (ip: string): string => {
  if (!ip || ip === "unknown") return "unknown"

  if (ip.includes(".")) {
    const parts = ip.split(".")
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
    }
    return ip
  }

  if (ip.includes(":")) {
    const normalized = ip.toLowerCase().split("%")[0]
    const parts = normalized.split(":").filter(Boolean)
    if (parts.length >= 4) {
      return `${parts.slice(0, 4).join(":")}::/64`
    }
    return `${normalized}::/64`
  }

  return ip
}

const getAbuseBucket = (now: Date): number => {
  const bucketMs = ABUSE_BUCKET_DAYS * 24 * 60 * 60 * 1000
  return Math.floor(now.getTime() / bucketMs)
}

const createGuestAbuseKey = (request: NextRequest, secret: string, now: Date): string => {
  const ipPrefix = getIpPrefix(getClientIp(request))
  const userAgent = (request.headers.get("user-agent") || "unknown").slice(0, 180)
  const acceptLanguage = (request.headers.get("accept-language") || "unknown").slice(0, 80)
  const bucket = getAbuseBucket(now)
  const fingerprint = `${ipPrefix}|${userAgent}|${acceptLanguage}|${bucket}`

  return createHmac("sha256", secret).update(fingerprint).digest("base64url")
}

type PostgresErrorLike = {
  code?: string
  message?: string
  detail?: string
  hint?: string
}

let shareSchemaPromise: Promise<void> | null = null

const getPostgresErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null
  if (!("code" in error)) return null
  const code = (error as PostgresErrorLike).code
  return typeof code === "string" ? code : null
}

const internalErrorResponse = (message: string, error: unknown) => {
  console.error(`[share] ${message}`, error)

  if (process.env.NODE_ENV !== "production") {
    const postgresError = (error ?? {}) as PostgresErrorLike
    return NextResponse.json(
      {
        message,
        error: {
          code: postgresError.code || "UNKNOWN",
          detail: postgresError.detail || postgresError.message || "Unknown error",
          hint: postgresError.hint || null,
        },
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ message }, { status: 500 })
}

const ensureShareSchema = async () => {
  if (!shareSchemaPromise) {
    shareSchemaPromise = (async () => {
      await authDbPool.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          title TEXT,
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)

      await authDbPool.query(`
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS user_id TEXT;
      `)

      await authDbPool.query(`
        CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents (created_at DESC);
      `)

      await authDbPool.query(`
        CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents (user_id);
      `)

      await authDbPool.query(`
        CREATE TABLE IF NOT EXISTS guest_share_usage (
          guest_id TEXT PRIMARY KEY,
          share_count INTEGER NOT NULL DEFAULT 1,
          first_shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)

      await authDbPool.query(`
        CREATE TABLE IF NOT EXISTS guest_share_abuse_usage (
          abuse_key TEXT PRIMARY KEY,
          share_count INTEGER NOT NULL DEFAULT 1,
          first_shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)

      await authDbPool.query(`
        CREATE INDEX IF NOT EXISTS idx_guest_share_abuse_first_shared_at
        ON guest_share_abuse_usage (first_shared_at DESC);
      `)

      await authDbPool.query(`
        ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
      `)

      await authDbPool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = 'documents'
              AND policyname = 'Allow public read access'
          ) THEN
            CREATE POLICY "Allow public read access"
            ON documents
            FOR SELECT
            USING (true);
          END IF;
        END
        $$;
      `)
    })().catch((error) => {
      shareSchemaPromise = null
      throw error
    })
  }

  return shareSchemaPromise
}

export async function POST(request: NextRequest) {
  let body: { content?: unknown } | null = null

  try {
    body = (await request.json()) as { content?: unknown }
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 })
  }

  const content = typeof body?.content === "string" ? body.content : ""
  if (!content.trim()) {
    return NextResponse.json({ message: "Content is required" }, { status: 400 })
  }

  await ensureAuthSchema()
  await ensureShareSchema()

  const session = await auth.api.getSession({
    headers: request.headers,
  })
  const userId = session?.user?.id ?? null

  let documentId = nanoid(10)
  const nowDate = new Date()
  const now = nowDate.toISOString()
  const secret = process.env.BETTER_AUTH_SECRET || "better-auth-secret-123456789"

  let guestCookieValue: string | null = null
  let guestId: string | null = null
  let guestAbuseKey: string | null = null
  let guestUsageCreated = false
  let guestAbuseUsageCreated = false
  let shouldWarnGuestLimitReachedOnNextShare = false

  if (!userId) {
    const existingGuestToken = request.cookies.get(GUEST_COOKIE_NAME)?.value
    const existingGuestId = existingGuestToken
      ? parseGuestToken(existingGuestToken, secret)
      : null
    if (existingGuestId) {
      return authRequiredResponse()
    }

    guestId = randomBytes(18).toString("base64url")
    guestCookieValue = createGuestToken(guestId, secret)
    guestAbuseKey = createGuestAbuseKey(request, secret, nowDate)

    try {
      await authDbPool.query(
        `
        INSERT INTO guest_share_abuse_usage (abuse_key, share_count, first_shared_at, last_shared_at)
        VALUES ($1, 1, $2::timestamptz, $2::timestamptz)
        `,
        [guestAbuseKey, now],
      )
      guestAbuseUsageCreated = true
    } catch (error) {
      const errorCode = getPostgresErrorCode(error)
      if (errorCode === "23505") {
        return authRequiredResponse()
      }

      // If this table is missing/misconfigured we still allow cookie-based free share.
      if (errorCode !== "42P01" && errorCode !== "42501") {
        return internalErrorResponse("Failed to validate guest abuse limit", error)
      }
    }

    try {
      await authDbPool.query(
        `
        INSERT INTO guest_share_usage (guest_id, share_count, first_shared_at, last_shared_at)
        VALUES ($1, 1, $2::timestamptz, $2::timestamptz)
        `,
        [guestId, now],
      )
      guestUsageCreated = true
      shouldWarnGuestLimitReachedOnNextShare = true
    } catch (error) {
      const errorCode = getPostgresErrorCode(error)
      if (errorCode === "23505") {
        return authRequiredResponse()
      }

      // Fallback mode when guest usage table is missing/misconfigured:
      // enforce one-share-per-browser using signed cookie only.
      if (errorCode === "42P01" || errorCode === "42501") {
        if (existingGuestId) {
          return authRequiredResponse()
        }
        shouldWarnGuestLimitReachedOnNextShare = true
      } else {
        return internalErrorResponse("Failed to validate guest share limit", error)
      }
    }
  }

  const insertWithUserColumn = async (id: string) => {
    return authDbPool.query(
      `
      INSERT INTO documents (id, content, user_id)
      VALUES ($1, $2, $3)
      `,
      [id, content, userId],
    )
  }

  const insertWithoutUserColumn = async (id: string) => {
    return authDbPool.query(
      `
      INSERT INTO documents (id, content)
      VALUES ($1, $2)
      `,
      [id, content],
    )
  }

  let documentInsertError: unknown = null
  try {
    await insertWithUserColumn(documentId)
  } catch (error) {
    const errorCode = getPostgresErrorCode(error)
    if (errorCode === "22P02") {
      // Some deployments use UUID ids for documents. Retry once with a UUID.
      documentId = randomUUID()
      try {
        await insertWithUserColumn(documentId)
      } catch (retryError) {
        documentInsertError = retryError
      }
    }

    if (errorCode === "42703" || errorCode === "42P01") {
      try {
        await ensureShareSchema()
      } catch (schemaError) {
        documentInsertError = schemaError
      }
    }

    if (!documentInsertError && errorCode === "42703") {
      try {
        await insertWithoutUserColumn(documentId)
      } catch (retryError) {
        documentInsertError = retryError
      }
    } else if (!documentInsertError && errorCode === "42P01") {
      try {
        await insertWithUserColumn(documentId)
      } catch (retryError) {
        documentInsertError = retryError
      }
    } else {
      documentInsertError = error
    }
  }

  if (documentInsertError) {
    if (guestAbuseUsageCreated && guestAbuseKey) {
      try {
        await authDbPool.query(`DELETE FROM guest_share_abuse_usage WHERE abuse_key = $1`, [
          guestAbuseKey,
        ])
      } catch {
        // best-effort rollback
      }
    }

    if (guestUsageCreated && guestId) {
      try {
        await authDbPool.query(`DELETE FROM guest_share_usage WHERE guest_id = $1`, [guestId])
      } catch {
        // best-effort rollback
      }
    }

    return internalErrorResponse("Failed to create shared document", documentInsertError)
  }

  const response = NextResponse.json({
    id: documentId,
    shareUrl: buildShareUrl(request, documentId),
    requiresAuthNextShare: !userId && shouldWarnGuestLimitReachedOnNextShare,
  })

  if (guestCookieValue) {
    response.cookies.set({
      name: GUEST_COOKIE_NAME,
      value: guestCookieValue,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: "/",
    })
  }

  return response
}
