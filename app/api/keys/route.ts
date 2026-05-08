import { NextRequest, NextResponse } from "next/server"

import { auth, ensureAuthSchema } from "@/lib/auth"
import { issueApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys"

export const runtime = "nodejs"

const sessionOnlyUser = async (request: NextRequest) => {
  await ensureAuthSchema()
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user?.id ?? null
}

const authRequired = () =>
  NextResponse.json(
    {
      code: "AUTH_REQUIRED",
      authRequired: true,
      message: "Sign in with Google to manage API keys.",
    },
    { status: 401 },
  )

export async function GET(request: NextRequest) {
  const userId = await sessionOnlyUser(request)
  if (!userId) return authRequired()

  try {
    const items = await listApiKeys(userId)
    return NextResponse.json({ items })
  } catch (error) {
    console.error("[api/keys] list failed", error)
    return NextResponse.json({ message: "Failed to load API keys" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const userId = await sessionOnlyUser(request)
  if (!userId) return authRequired()

  let body: { label?: unknown } | null = null
  try {
    body = (await request.json().catch(() => null)) as { label?: unknown } | null
  } catch {
    body = null
  }
  const label = typeof body?.label === "string" ? body.label : "Default key"

  try {
    const created = await issueApiKey(userId, label)
    return NextResponse.json({
      id: created.id,
      label: created.label,
      last4: created.last4,
      createdAt: created.createdAt,
      // Plaintext key is shown once and never again.
      plainKey: created.plainKey,
    })
  } catch (error) {
    console.error("[api/keys] create failed", error)
    return NextResponse.json({ message: "Failed to create API key" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const userId = await sessionOnlyUser(request)
  if (!userId) return authRequired()

  const id = request.nextUrl.searchParams.get("id")?.trim()
  if (!id) {
    return NextResponse.json({ message: "Key id is required" }, { status: 400 })
  }

  try {
    const revoked = await revokeApiKey(userId, id)
    if (!revoked) {
      return NextResponse.json({ message: "Key not found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    console.error("[api/keys] revoke failed", error)
    return NextResponse.json({ message: "Failed to revoke API key" }, { status: 500 })
  }
}
