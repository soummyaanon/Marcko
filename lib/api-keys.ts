import "server-only"

import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import type { NextRequest } from "next/server"

import { auth, authDbPool, ensureAuthSchema } from "@/lib/auth"

const KEY_PREFIX = "mk_"
/** Length of the random body (in bytes). 32 bytes ≈ 43 base64url chars → 256 bits of entropy. */
const KEY_BYTES = 32

let apiKeysSchemaPromise: Promise<void> | null = null

const ensureApiKeysSchema = async () => {
  if (!apiKeysSchemaPromise) {
    apiKeysSchemaPromise = (async () => {
      await authDbPool.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          label TEXT NOT NULL,
          key_hash TEXT NOT NULL UNIQUE,
          last4 TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_used_at TIMESTAMPTZ,
          revoked_at TIMESTAMPTZ
        );
      `)
      await authDbPool.query(
        `CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);`,
      )
      await authDbPool.query(
        `CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys (key_hash) WHERE revoked_at IS NULL;`,
      )
    })().catch((error) => {
      apiKeysSchemaPromise = null
      throw error
    })
  }
  return apiKeysSchemaPromise
}

const toBase64Url = (buf: Buffer) =>
  buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")

const sha256Hex = (input: string) =>
  createHash("sha256").update(input).digest("hex")

const generatePlainKey = () => `${KEY_PREFIX}${toBase64Url(randomBytes(KEY_BYTES))}`

export type ApiKeyRow = {
  id: string
  label: string
  last4: string
  createdAt: string
  lastUsedAt: string | null
}

export const issueApiKey = async (
  userId: string,
  label: string,
): Promise<{ id: string; label: string; plainKey: string; last4: string; createdAt: string }> => {
  await ensureApiKeysSchema()

  const plainKey = generatePlainKey()
  const keyHash = sha256Hex(plainKey)
  const last4 = plainKey.slice(-4)
  const id = toBase64Url(randomBytes(12))

  const result = await authDbPool.query(
    `
    INSERT INTO api_keys (id, user_id, label, key_hash, last4)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, label, last4, created_at
    `,
    [id, userId, label.trim().slice(0, 80) || "Untitled key", keyHash, last4],
  )
  const row = result.rows[0]
  return {
    id: String(row.id),
    label: String(row.label),
    plainKey,
    last4: String(row.last4),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  }
}

export const listApiKeys = async (userId: string): Promise<ApiKeyRow[]> => {
  await ensureApiKeysSchema()
  const result = await authDbPool.query(
    `
    SELECT id, label, last4, created_at, last_used_at
    FROM api_keys
    WHERE user_id = $1 AND revoked_at IS NULL
    ORDER BY created_at DESC
    `,
    [userId],
  )
  return result.rows.map((row) => ({
    id: String(row.id),
    label: String(row.label),
    last4: String(row.last4),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    lastUsedAt:
      row.last_used_at instanceof Date
        ? row.last_used_at.toISOString()
        : row.last_used_at
          ? String(row.last_used_at)
          : null,
  }))
}

export const revokeApiKey = async (
  userId: string,
  keyId: string,
): Promise<boolean> => {
  await ensureApiKeysSchema()
  const result = await authDbPool.query(
    `
    UPDATE api_keys
    SET revoked_at = NOW()
    WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
    `,
    [keyId, userId],
  )
  return (result.rowCount ?? 0) > 0
}

const isLikelyApiKey = (token: string) =>
  token.startsWith(KEY_PREFIX) && token.length >= KEY_PREFIX.length + 16

const lookupBearerUser = async (
  token: string,
): Promise<{ userId: string } | null> => {
  if (!isLikelyApiKey(token)) return null
  await ensureApiKeysSchema()
  const expectedHash = sha256Hex(token)

  const result = await authDbPool.query(
    `
    SELECT id, user_id, key_hash
    FROM api_keys
    WHERE key_hash = $1 AND revoked_at IS NULL
    LIMIT 1
    `,
    [expectedHash],
  )
  const row = result.rows[0]
  if (!row) return null

  // Constant-time confirm against the row's stored hash.
  const a = Buffer.from(String(row.key_hash), "hex")
  const b = Buffer.from(expectedHash, "hex")
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  // Best-effort touch of last_used_at; ignore errors so a hot path stays fast.
  authDbPool
    .query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id])
    .catch(() => {})

  return { userId: String(row.user_id) }
}

const extractBearerToken = (request: NextRequest): string | null => {
  const header = request.headers.get("authorization") || request.headers.get("Authorization")
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

export type ResolvedAuth = {
  userId: string
  via: "session" | "bearer"
}

/**
 * Resolves the requesting user via Better Auth session OR a Marcko API key
 * sent as `Authorization: Bearer mk_…`. Returns null if neither is valid.
 */
export const resolveAuthUser = async (
  request: NextRequest,
): Promise<ResolvedAuth | null> => {
  await ensureAuthSchema()
  const session = await auth.api.getSession({ headers: request.headers })
  const sessionUserId = session?.user?.id ?? null
  if (sessionUserId) return { userId: sessionUserId, via: "session" }

  const token = extractBearerToken(request)
  if (!token) return null

  const bearerUser = await lookupBearerUser(token)
  if (!bearerUser) return null

  return { userId: bearerUser.userId, via: "bearer" }
}
