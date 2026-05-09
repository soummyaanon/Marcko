// Stable, test-only secret so secure-content.ts has a deterministic key.
process.env.DOCUMENT_ENCRYPTION_KEY ??=
  "test-document-encryption-key-do-not-use-in-prod"
process.env.NODE_ENV ??= "test"
