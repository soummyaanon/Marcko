import { describe, expect, it } from "vitest"

import {
  buildContentPreview,
  createSignedAccessToken,
  decryptStoredContent,
  encryptStoredContent,
  verifySignedAccessToken,
} from "@/lib/secure-content"

const ENC_PREFIX = "enc:v1:"

describe("buildContentPreview", () => {
  it("collapses whitespace and trims", () => {
    expect(buildContentPreview("  hello\n\tworld  ")).toBe("hello world")
  })

  it("respects the maxLength cap", () => {
    const preview = buildContentPreview("a".repeat(500), 50)
    expect(preview).toHaveLength(50)
  })

  it("defaults maxLength to 140", () => {
    const preview = buildContentPreview("a".repeat(500))
    expect(preview).toHaveLength(140)
  })
})

describe("encryptStoredContent / decryptStoredContent", () => {
  it("round-trips arbitrary unicode payloads", () => {
    const plain = "🛡️ Marcko keeps secrets — even with emoji, accents éàü, and CJK 你好"
    const cipher = encryptStoredContent(plain)
    expect(cipher.startsWith(ENC_PREFIX)).toBe(true)
    expect(decryptStoredContent(cipher)).toBe(plain)
  })

  it("produces a different ciphertext per call (fresh IV)", () => {
    const plain = "the quick brown fox jumps over the lazy dog"
    const a = encryptStoredContent(plain)
    const b = encryptStoredContent(plain)
    expect(a).not.toBe(b)
    expect(decryptStoredContent(a)).toBe(plain)
    expect(decryptStoredContent(b)).toBe(plain)
  })

  it("falls through to plaintext for legacy unprefixed values (backward compat)", () => {
    expect(decryptStoredContent("legacy plaintext content")).toBe(
      "legacy plaintext content",
    )
  })

  it("rejects ciphertext with a tampered auth tag (GCM integrity)", () => {
    const cipher = encryptStoredContent("some sensitive doc body")
    const [, payload] = cipher.split(":", 2)
    expect(payload).toBeTruthy()
    const [iv, , body] = payload!.split(".")
    // Replace auth tag with all-zero bytes of the same encoded length to
    // simulate an attacker swapping just the tag.
    const tamperedTag = Buffer.alloc(16).toString("base64url")
    const tampered = `${ENC_PREFIX}${iv}.${tamperedTag}.${body}`
    expect(() => decryptStoredContent(tampered)).toThrow()
  })

  it("rejects ciphertext with a flipped body byte", () => {
    const cipher = encryptStoredContent("integrity must hold")
    // Flip one base64url char in the encrypted body.
    const flipped = cipher.replace(/.$/, (last) => (last === "A" ? "B" : "A"))
    if (flipped !== cipher) {
      expect(() => decryptStoredContent(flipped)).toThrow()
    }
  })

  it("rejects malformed payloads missing IV / tag / body separators", () => {
    expect(() => decryptStoredContent("enc:v1:onlyone")).toThrow(
      /Invalid encrypted payload/,
    )
    expect(() => decryptStoredContent("enc:v1:a.b")).toThrow(
      /Invalid encrypted payload/,
    )
  })
})

describe("createSignedAccessToken / verifySignedAccessToken", () => {
  it("verifies a freshly issued token for the matching document", () => {
    const docId = "doc_abc123"
    const token = createSignedAccessToken(docId)
    expect(verifySignedAccessToken(docId, token)).toBe(true)
  })

  it("rejects a valid token used against a different document id", () => {
    const token = createSignedAccessToken("doc_abc123")
    expect(verifySignedAccessToken("doc_OTHER", token)).toBe(false)
  })

  it("rejects an expired token", () => {
    // Hand-forge a token with an expiry in the past, signed with a
    // wrong key, so verification fails on either expiry or HMAC.
    const expired = `${Date.now() - 1000}.AAAA`
    expect(verifySignedAccessToken("doc_x", expired)).toBe(false)
  })

  it("rejects a token whose HMAC has been tampered with", () => {
    const docId = "doc_tamper"
    const token = createSignedAccessToken(docId)
    const dot = token.indexOf(".")
    const expires = token.slice(0, dot)
    const hmac = token.slice(dot + 1)
    const flipped = hmac.replace(/.$/, (last) => (last === "A" ? "B" : "A"))
    if (flipped !== hmac) {
      const tampered = `${expires}.${flipped}`
      expect(verifySignedAccessToken(docId, tampered)).toBe(false)
    }
  })

  it("rejects malformed tokens (no dot, non-numeric expiry)", () => {
    expect(verifySignedAccessToken("doc_x", "no-dot-here")).toBe(false)
    expect(verifySignedAccessToken("doc_x", "notanumber.AAAA")).toBe(false)
  })

  it("rejects tokens whose hmac segment length is wrong", () => {
    const token = createSignedAccessToken("doc_len")
    const dot = token.indexOf(".")
    const expires = token.slice(0, dot)
    // Truncate hmac → length mismatch should bail out before timingSafeEqual.
    const tampered = `${expires}.AAAA`
    expect(verifySignedAccessToken("doc_len", tampered)).toBe(false)
  })
})
