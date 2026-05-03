import { NextRequest, NextResponse } from "next/server"

import { auth, authDbPool, ensureAuthSchema } from "@/lib/auth"
import { decryptStoredContent, verifySignedAccessToken } from "@/lib/secure-content"

export const runtime = "nodejs"

const decode = (raw: unknown): string => {
  const value = String(raw ?? "")
  try {
    return decryptStoredContent(value)
  } catch {
    return value
  }
}

export async function GET(request: NextRequest) {
  await ensureAuthSchema()

  const documentId = request.nextUrl.searchParams.get("id")?.trim() ?? ""
  if (!documentId) {
    return NextResponse.json({ message: "Document id is required." }, { status: 400 })
  }

  // Find the document and check access.
  const docResult = await authDbPool.query(
    `SELECT id, user_id, visibility FROM documents WHERE id = $1 LIMIT 1`,
    [documentId],
  )
  if (docResult.rowCount === 0) {
    return NextResponse.json({ message: "Document not found." }, { status: 404 })
  }
  const doc = docResult.rows[0]
  const visibility = (doc.visibility === "private" ? "private" : "public") as "public" | "private"

  const session = await auth.api.getSession({ headers: request.headers })
  const userId = session?.user?.id ?? null
  const isOwner = Boolean(userId && doc.user_id === userId)

  if (visibility === "private" && !isOwner) {
    const token = request.nextUrl.searchParams.get("token") ?? ""
    if (!token || !verifySignedAccessToken(documentId, token)) {
      return NextResponse.json({ message: "Access denied." }, { status: 403 })
    }
  }

  const versionParam = request.nextUrl.searchParams.get("version")

  if (versionParam !== null) {
    const versionNumber = Number.parseInt(versionParam, 10)
    if (!Number.isFinite(versionNumber) || versionNumber < 0) {
      return NextResponse.json({ message: "Invalid version." }, { status: 400 })
    }
    const result = await authDbPool.query(
      `SELECT version, content, created_at
         FROM document_versions
         WHERE document_id = $1 AND version = $2
         LIMIT 1`,
      [documentId, versionNumber],
    )
    if (result.rowCount === 0) {
      return NextResponse.json({ message: "Version not found." }, { status: 404 })
    }
    const row = result.rows[0]
    return NextResponse.json({
      id: documentId,
      version: Number(row.version),
      content: decode(row.content),
      createdAt: row.created_at,
    })
  }

  const list = await authDbPool.query(
    `SELECT version, created_at
       FROM document_versions
       WHERE document_id = $1
       ORDER BY version ASC`,
    [documentId],
  )

  return NextResponse.json({
    id: documentId,
    versions: list.rows.map((row) => ({
      version: Number(row.version),
      createdAt: row.created_at,
    })),
    latest: list.rows.length === 0 ? null : Number(list.rows[list.rows.length - 1].version),
  })
}
