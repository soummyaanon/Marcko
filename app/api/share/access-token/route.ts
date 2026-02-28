import { NextRequest, NextResponse } from "next/server"

import { auth, authDbPool, ensureAuthSchema } from "@/lib/auth"
import { createSignedAccessToken } from "@/lib/secure-content"

export const runtime = "nodejs"

/**
 * POST /api/share/access-token
 *
 * Generates a time-limited signed access token for a private document so that
 * the document URL can be shared with AI assistants (ChatGPT, Claude, etc.)
 * that cannot sign in with Google.
 *
 * Body: { documentId: string }
 * Returns: { token: string, expiresIn: number }
 */
export async function POST(request: NextRequest) {
  await ensureAuthSchema()

  const session = await auth.api.getSession({
    headers: request.headers,
  })

  const userId = session?.user?.id ?? null
  if (!userId) {
    return NextResponse.json(
      { message: "Authentication required." },
      { status: 401 },
    )
  }

  let body: { documentId?: unknown } | null = null
  try {
    body = (await request.json()) as { documentId?: unknown }
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON payload." },
      { status: 400 },
    )
  }

  const documentId = typeof body?.documentId === "string" ? body.documentId.trim() : ""
  if (!documentId) {
    return NextResponse.json(
      { message: "documentId is required." },
      { status: 400 },
    )
  }

  // Verify the user owns this document
  try {
    const result = await authDbPool.query(
      `SELECT id, visibility FROM documents WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [documentId, userId],
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { message: "Document not found or access denied." },
        { status: 404 },
      )
    }
  } catch (error) {
    console.error("[access-token] Failed to verify document ownership", error)
    return NextResponse.json(
      { message: "Failed to verify document." },
      { status: 500 },
    )
  }

  const token = createSignedAccessToken(documentId)

  return NextResponse.json({
    token,
    expiresIn: 30 * 60, // 30 minutes in seconds
  })
}
