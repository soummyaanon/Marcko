import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"

import { auth, authDbPool, ensureAuthSchema } from "@/lib/auth"
import { resolveAuthUser } from "@/lib/api-keys"
import { buildContentPreview, decryptStoredContent, encryptStoredContent } from "@/lib/secure-content"

export const runtime = "nodejs"

const authRequiredResponse = () => {
  return NextResponse.json(
    {
      code: "AUTH_REQUIRED",
      authRequired: true,
      message: "Please sign in with Google to share documents.",
    },
    { status: 403 },
  )
}

const buildShareUrl = (request: NextRequest, id: string) => {
  return `${request.nextUrl.origin}/share/${id}`
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
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
          CHECK (visibility IN ('public', 'private'));
      `)

      await authDbPool.query(`
        CREATE INDEX IF NOT EXISTS idx_documents_visibility ON documents(visibility);
      `)

      await authDbPool.query(`
        ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
      `)

      await authDbPool.query(`
        CREATE TABLE IF NOT EXISTS document_versions (
          document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          version INTEGER NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (document_id, version)
        );
      `)

      await authDbPool.query(`
        CREATE INDEX IF NOT EXISTS idx_document_versions_doc_created
          ON document_versions(document_id, created_at DESC);
      `)

      await authDbPool.query(`
        ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
      `)

      await authDbPool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = 'document_versions'
              AND policyname = 'Allow public read access'
          ) THEN
            CREATE POLICY "Allow public read access"
            ON document_versions
            FOR SELECT
            USING (true);
          END IF;
        END
        $$;
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

export async function GET(request: NextRequest) {
  await ensureAuthSchema()
  await ensureShareSchema()

  const session = await auth.api.getSession({
    headers: request.headers,
  })
  const userId = session?.user?.id ?? null

  if (!userId) {
    return NextResponse.json(
      { message: "Please sign in with Google to view your share history." },
      { status: 401 },
    )
  }

  const docId = request.nextUrl.searchParams.get("id")?.trim()
  if (docId) {
    try {
      const result = await authDbPool.query(
        `
        SELECT id, content, visibility
        FROM documents
        WHERE id = $1 AND user_id = $2
        LIMIT 1
        `,
        [docId, userId],
      )
      if (result.rowCount === 0) {
        return NextResponse.json(
          { message: "Document not found or access denied." },
          { status: 404 },
        )
      }
      const row = result.rows[0]
      let content: string
      try {
        content = decryptStoredContent(String(row.content ?? ""))
      } catch {
        content = String(row.content ?? "")
      }
      return NextResponse.json({
        id: String(row.id),
        content,
        visibility: (row.visibility === "private" ? "private" : "public") as "public" | "private",
        shareUrl: buildShareUrl(request, String(row.id)),
      })
    } catch (error) {
      return internalErrorResponse("Failed to fetch document", error)
    }
  }

  const rawLimit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "25", 10)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 25

  try {
    const result = await authDbPool.query(
      `
      SELECT
        id,
        content,
        created_at,
        updated_at,
        visibility
      FROM documents
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [userId, limit],
    )

    return NextResponse.json({
      items: result.rows.map((row) => ({
        // Preview is derived from decrypted content to avoid storing plaintext snippets.
        preview: (() => {
          const rawContent = String(row.content ?? "")
          try {
            return buildContentPreview(decryptStoredContent(rawContent))
          } catch {
            return buildContentPreview(rawContent)
          }
        })(),
        id: String(row.id),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        shareUrl: buildShareUrl(request, String(row.id)),
        visibility: (row.visibility === "private" ? "private" : "public") as "public" | "private",
      })),
    })
  } catch (error) {
    return internalErrorResponse("Failed to fetch share history", error)
  }
}

export async function POST(request: NextRequest) {
  let body: { content?: unknown; visibility?: unknown } | null = null

  try {
    body = (await request.json()) as { content?: unknown; visibility?: unknown }
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 })
  }

  const content = typeof body?.content === "string" ? body.content : ""
  if (!content.trim()) {
    return NextResponse.json({ message: "Content is required" }, { status: 400 })
  }

  const visibility = body?.visibility === "private" ? "private" : "public"

  await ensureAuthSchema()
  await ensureShareSchema()

  const resolved = await resolveAuthUser(request)
  const userId = resolved?.userId ?? null
  if (!userId) {
    return authRequiredResponse()
  }

  let documentId = nanoid()
  let encryptedContent: string
  try {
    encryptedContent = encryptStoredContent(content)
  } catch (error) {
    return internalErrorResponse("Failed to encrypt shared document", error)
  }
  const insertDocument = async (id: string) => {
    const client = await authDbPool.connect()
    try {
      await client.query("BEGIN")
      await client.query(
        `
        INSERT INTO documents (id, content, user_id, visibility)
        VALUES ($1, $2, $3, $4)
        `,
        [id, encryptedContent, userId, visibility],
      )
      await client.query(
        `
        INSERT INTO document_versions (document_id, version, content)
        VALUES ($1, 0, $2)
        ON CONFLICT (document_id, version) DO NOTHING
        `,
        [id, encryptedContent],
      )
      await client.query("COMMIT")
      return
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }

  try {
    await insertDocument(documentId)
  } catch (error) {
    const code = getPostgresErrorCode(error)
    try {
      if (code === "22P02") {
        // Some deployments use UUID ids for documents. Retry once with a UUID.
        documentId = randomUUID()
        await insertDocument(documentId)
      } else if (code === "42703" || code === "42P01") {
        await ensureShareSchema()
        await insertDocument(documentId)
      } else {
        throw error
      }
    } catch (retryError) {
      return internalErrorResponse("Failed to create shared document", retryError)
    }
  }

  return NextResponse.json({
    id: documentId,
    shareUrl: buildShareUrl(request, documentId),
    visibility,
  })
}

export async function PATCH(request: NextRequest) {
  await ensureAuthSchema()
  await ensureShareSchema()

  const session = await auth.api.getSession({
    headers: request.headers,
  })
  const userId = session?.user?.id ?? null
  if (!userId) {
    return authRequiredResponse()
  }

  let body: { id?: unknown; visibility?: unknown; content?: unknown } | null = null
  try {
    body = (await request.json()) as { id?: unknown; visibility?: unknown; content?: unknown }
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 })
  }

  const documentId = typeof body?.id === "string" ? body.id.trim() : ""
  if (!documentId) {
    return NextResponse.json({ message: "Document id is required." }, { status: 400 })
  }

  const content = typeof body?.content === "string" ? body.content : undefined
  if (content !== undefined && !content.trim()) {
    return NextResponse.json({ message: "Content cannot be empty." }, { status: 400 })
  }

  const hasContent = content !== undefined
  const hasVisibility = body?.visibility !== undefined

  if (!hasContent && !hasVisibility) {
    return NextResponse.json(
      { message: "Either content or visibility is required." },
      { status: 400 },
    )
  }

  const visibility = body?.visibility === "private" ? "private" : "public"

  if (hasContent && !hasVisibility) {
    let encryptedContent: string
    try {
      encryptedContent = encryptStoredContent(content)
    } catch (error) {
      return internalErrorResponse("Failed to encrypt content", error)
    }
    try {
      const result = await updateDocumentContentWithVersion({
        documentId,
        userId,
        newPlainContent: content!,
        newEncryptedContent: encryptedContent,
      })
      if (!result) {
        return NextResponse.json(
          { message: "Document not found or access denied." },
          { status: 404 },
        )
      }
      return NextResponse.json({
        ok: true,
        id: documentId,
        visibility: result.visibility,
        version: result.version,
        shareUrl: buildShareUrl(request, documentId),
      })
    } catch (error) {
      return internalErrorResponse("Failed to update document content", error)
    }
  }

  if (hasVisibility && !hasContent) {
    try {
      const result = await authDbPool.query(
        `
        UPDATE documents
        SET visibility = $1, updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING id, visibility
        `,
        [visibility, documentId, userId],
      )
      if (result.rowCount === 0) {
        return NextResponse.json(
          { message: "Document not found or access denied." },
          { status: 404 },
        )
      }
      return NextResponse.json({ ok: true, id: documentId, visibility })
    } catch (error) {
      return internalErrorResponse("Failed to update document visibility", error)
    }
  }

  if (content === undefined) {
    return NextResponse.json({ message: "Content is required." }, { status: 400 })
  }

  let encryptedContent: string
  try {
    encryptedContent = encryptStoredContent(content)
  } catch (error) {
    return internalErrorResponse("Failed to encrypt content", error)
  }
  try {
    const result = await updateDocumentContentWithVersion({
      documentId,
      userId,
      newPlainContent: content!,
      newEncryptedContent: encryptedContent,
      newVisibility: visibility,
    })
    if (!result) {
      return NextResponse.json(
        { message: "Document not found or access denied." },
        { status: 404 },
      )
    }
    return NextResponse.json({
      ok: true,
      id: documentId,
      visibility: result.visibility,
      version: result.version,
      shareUrl: buildShareUrl(request, documentId),
    })
  } catch (error) {
    return internalErrorResponse("Failed to update document", error)
  }
}

/**
 * Updates document content and appends a new version row only if the content
 * actually changed. Backfills v0 from the previous content if missing.
 * Returns null if the document doesn't exist or doesn't belong to the user.
 */
async function updateDocumentContentWithVersion(args: {
  documentId: string
  userId: string
  newPlainContent: string
  newEncryptedContent: string
  newVisibility?: "public" | "private"
}): Promise<{ visibility: "public" | "private"; version: number } | null> {
  const { documentId, userId, newPlainContent, newEncryptedContent, newVisibility } = args
  const client = await authDbPool.connect()
  try {
    await client.query("BEGIN")
    const currentResult = await client.query(
      `
      SELECT content, visibility
      FROM documents
      WHERE id = $1 AND user_id = $2
      FOR UPDATE
      `,
      [documentId, userId],
    )
    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK")
      return null
    }
    const currentEncrypted = String(currentResult.rows[0].content ?? "")
    let currentPlain = ""
    try {
      currentPlain = decryptStoredContent(currentEncrypted)
    } catch {
      currentPlain = currentEncrypted
    }

    const maxVersionResult = await client.query(
      `SELECT COALESCE(MAX(version), -1) AS max_version
         FROM document_versions
         WHERE document_id = $1`,
      [documentId],
    )
    let maxVersion = Number(maxVersionResult.rows[0]?.max_version ?? -1)

    if (maxVersion < 0) {
      await client.query(
        `INSERT INTO document_versions (document_id, version, content)
         VALUES ($1, 0, $2)
         ON CONFLICT (document_id, version) DO NOTHING`,
        [documentId, currentEncrypted],
      )
      maxVersion = 0
    }

    const contentChanged = currentPlain !== newPlainContent
    let appendedVersion = maxVersion
    if (contentChanged) {
      appendedVersion = maxVersion + 1
      await client.query(
        `INSERT INTO document_versions (document_id, version, content)
         VALUES ($1, $2, $3)`,
        [documentId, appendedVersion, newEncryptedContent],
      )
    }

    const updated = await client.query(
      newVisibility === undefined
        ? `UPDATE documents SET content = $1, updated_at = NOW()
             WHERE id = $2 AND user_id = $3
             RETURNING visibility`
        : `UPDATE documents SET content = $1, visibility = $2, updated_at = NOW()
             WHERE id = $3 AND user_id = $4
             RETURNING visibility`,
      newVisibility === undefined
        ? [newEncryptedContent, documentId, userId]
        : [newEncryptedContent, newVisibility, documentId, userId],
    )

    await client.query("COMMIT")
    const visibility = (updated.rows[0]?.visibility === "private" ? "private" : "public") as "public" | "private"
    return { visibility, version: appendedVersion }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

export async function DELETE(request: NextRequest) {
  await ensureAuthSchema()
  await ensureShareSchema()

  const session = await auth.api.getSession({
    headers: request.headers,
  })
  const userId = session?.user?.id ?? null
  if (!userId) {
    return authRequiredResponse()
  }

  const documentId = request.nextUrl.searchParams.get("id")?.trim() ?? ""
  if (!documentId) {
    return NextResponse.json({ message: "Document id is required." }, { status: 400 })
  }

  try {
    const result = await authDbPool.query(
      `
      DELETE FROM documents
      WHERE id = $1 AND user_id = $2
      RETURNING id
      `,
      [documentId, userId],
    )

    if (result.rowCount === 0) {
      return NextResponse.json({ message: "Share link not found." }, { status: 404 })
    }

    return NextResponse.json({ ok: true, id: documentId })
  } catch (error) {
    return internalErrorResponse("Failed to revoke share link", error)
  }
}
