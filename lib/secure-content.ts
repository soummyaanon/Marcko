import "server-only"

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

const ENCRYPTION_VERSION = "enc:v1"
const CIPHER_ALGORITHM = "aes-256-gcm"
const IV_SIZE_BYTES = 12

const getEncryptionSecret = (): string => {
  if (process.env.DOCUMENT_ENCRYPTION_KEY) {
    return process.env.DOCUMENT_ENCRYPTION_KEY
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("DOCUMENT_ENCRYPTION_KEY is required in production.")
  }

  return process.env.BETTER_AUTH_SECRET || "dev-only-insecure-key-change-me"
}

const getEncryptionKey = (): Buffer => {
  return createHash("sha256").update(getEncryptionSecret()).digest()
}

export const buildContentPreview = (content: string, maxLength = 140): string => {
  return content.replace(/\s+/g, " ").trim().slice(0, maxLength)
}

export const encryptStoredContent = (plainText: string): string => {
  const iv = randomBytes(IV_SIZE_BYTES)
  const cipher = createCipheriv(CIPHER_ALGORITHM, getEncryptionKey(), iv)

  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return `${ENCRYPTION_VERSION}:${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`
}

export const decryptStoredContent = (storedValue: string): string => {
  if (!storedValue.startsWith(`${ENCRYPTION_VERSION}:`)) {
    // Backward compatibility for already stored plaintext rows.
    return storedValue
  }

  const payload = storedValue.slice(`${ENCRYPTION_VERSION}:`.length)
  const [ivEncoded, authTagEncoded, encryptedEncoded] = payload.split(".")

  if (!ivEncoded || !authTagEncoded || !encryptedEncoded) {
    throw new Error("Invalid encrypted payload format")
  }

  const decipher = createDecipheriv(
    CIPHER_ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivEncoded, "base64url"),
  )
  decipher.setAuthTag(Buffer.from(authTagEncoded, "base64url"))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, "base64url")),
    decipher.final(),
  ])

  return decrypted.toString("utf8")
}

// ---------------------------------------------------------------------------
// Signed access tokens – stateless, HMAC-based, time-limited tokens that
// allow temporary unauthenticated access to a private document (e.g. when
// opening a doc in an AI assistant that cannot sign in with Google).
// ---------------------------------------------------------------------------

const ACCESS_TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minutes

const getTokenSigningKey = (): Buffer => {
  return createHash("sha256")
    .update(`access-token:${getEncryptionSecret()}`)
    .digest()
}

/**
 * Create a time-limited signed access token for a document.
 * Format: `<expiresEpochMs>.<hmacBase64url>`
 */
export const createSignedAccessToken = (documentId: string): string => {
  const expires = Date.now() + ACCESS_TOKEN_TTL_MS
  const payload = `${documentId}:${expires}`
  const hmac = createHmac("sha256", getTokenSigningKey())
    .update(payload)
    .digest("base64url")
  return `${expires}.${hmac}`
}

/**
 * Verify a signed access token for a given document.
 * Returns `true` when the token is valid and not expired.
 */
export const verifySignedAccessToken = (
  documentId: string,
  token: string,
): boolean => {
  const dotIndex = token.indexOf(".")
  if (dotIndex === -1) return false

  const expiresStr = token.slice(0, dotIndex)
  const receivedHmac = token.slice(dotIndex + 1)

  const expires = Number(expiresStr)
  if (!Number.isFinite(expires) || Date.now() > expires) return false

  const payload = `${documentId}:${expiresStr}`
  const expectedHmac = createHmac("sha256", getTokenSigningKey())
    .update(payload)
    .digest("base64url")

  // Constant-time comparison
  if (receivedHmac.length !== expectedHmac.length) return false
  const a = Buffer.from(receivedHmac)
  const b = Buffer.from(expectedHmac)
  return timingSafeEqual(a, b)
}
