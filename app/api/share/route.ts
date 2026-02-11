import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { nanoid } from "nanoid"

import { auth, authDbPool, ensureAuthSchema } from "@/lib/auth"
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

  const rawLimit = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "25", 10)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 25

  try {
    const result = await authDbPool.query(
      `
      SELECT
        id,
        content,
        created_at,
        updated_at
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
      })),
    })
  } catch (error) {
    return internalErrorResponse("Failed to fetch share history", error)
  }
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
    return authDbPool.query(
      `
      INSERT INTO documents (id, content, user_id)
      VALUES ($1, $2, $3)
      `,
      [id, encryptedContent, userId],
    )
  }

  let documentInsertError: unknown = null
  try {
    await insertDocument(documentId)
  } catch (error) {
    const errorCode = getPostgresErrorCode(error)
    if (errorCode === "22P02") {
      // Some deployments use UUID ids for documents. Retry once with a UUID.
      documentId = randomUUID()
      try {
        await insertDocument(documentId)
      } catch (retryError) {
        documentInsertError = retryError
      }
    }

    if (!documentInsertError && (errorCode === "42703" || errorCode === "42P01")) {
      try {
        await ensureShareSchema()
        await insertDocument(documentId)
      } catch (retryError) {
        documentInsertError = retryError
      }
    } else {
      documentInsertError = error
    }
  }

  if (documentInsertError) {
    return internalErrorResponse("Failed to create shared document", documentInsertError)
  }

  return NextResponse.json({
    id: documentId,
    shareUrl: buildShareUrl(request, documentId),
  })
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
