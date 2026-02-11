import { NextRequest, NextResponse } from "next/server"

import { auth, authDbPool, ensureAuthSchema } from "@/lib/auth"
import { decryptStoredContent, encryptStoredContent } from "@/lib/secure-content"

export const runtime = "nodejs"

let draftSchemaPromise: Promise<void> | null = null

const ensureDraftSchema = async () => {
  if (!draftSchemaPromise) {
    draftSchemaPromise = (async () => {
      await authDbPool.query(`
        CREATE TABLE IF NOT EXISTS user_drafts (
          user_id TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)

      await authDbPool.query(`
        CREATE INDEX IF NOT EXISTS idx_user_drafts_updated_at
        ON user_drafts (updated_at DESC);
      `)
    })().catch((error) => {
      draftSchemaPromise = null
      throw error
    })
  }

  return draftSchemaPromise
}

const getUserIdFromSession = async (request: NextRequest): Promise<string | null> => {
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  return session?.user?.id ?? null
}

export async function GET(request: NextRequest) {
  await ensureAuthSchema()
  await ensureDraftSchema()

  const userId = await getUserIdFromSession(request)
  if (!userId) {
    return NextResponse.json(
      { message: "Please sign in with Google to access your draft." },
      { status: 401 },
    )
  }

  try {
    const result = await authDbPool.query(
      `
      SELECT content, updated_at
      FROM user_drafts
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    )

    const row = result.rows[0]
    if (!row) {
      return NextResponse.json({ content: null, updatedAt: null })
    }

    const decryptedContent = decryptStoredContent(String(row.content))
    return NextResponse.json({
      content: decryptedContent,
      updatedAt: row.updated_at ?? null,
    })
  } catch (error) {
    console.error("[draft] Failed to fetch draft", error)
    return NextResponse.json({ message: "Failed to fetch draft." }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  await ensureAuthSchema()
  await ensureDraftSchema()

  const userId = await getUserIdFromSession(request)
  if (!userId) {
    return NextResponse.json(
      { message: "Please sign in with Google to save your draft." },
      { status: 401 },
    )
  }

  let body: { content?: unknown } | null = null
  try {
    body = (await request.json()) as { content?: unknown }
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 })
  }

  const content = body?.content
  if (typeof content !== "string") {
    return NextResponse.json({ message: "Content must be a string." }, { status: 400 })
  }

  let encryptedContent: string
  try {
    encryptedContent = encryptStoredContent(content)
  } catch (error) {
    console.error("[draft] Failed to encrypt draft", error)
    return NextResponse.json({ message: "Failed to encrypt draft." }, { status: 500 })
  }

  try {
    await authDbPool.query(
      `
      INSERT INTO user_drafts (user_id, content, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        content = EXCLUDED.content,
        updated_at = NOW()
      `,
      [userId, encryptedContent],
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[draft] Failed to save draft", error)
    return NextResponse.json({ message: "Failed to save draft." }, { status: 500 })
  }
}
