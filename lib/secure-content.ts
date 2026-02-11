import "server-only"

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

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
