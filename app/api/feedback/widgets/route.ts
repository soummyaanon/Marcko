import { NextRequest, NextResponse } from "next/server"

import { auth, ensureAuthSchema } from "@/lib/auth"
import {
  createFeedbackWidget,
  listFeedbackWidgets,
  type FeedbackQuestion,
} from "@/lib/feedback"

export const runtime = "nodejs"

const sessionUser = async (request: NextRequest) => {
  await ensureAuthSchema()
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user?.id ?? null
}

const authRequired = () =>
  NextResponse.json(
    {
      code: "AUTH_REQUIRED",
      authRequired: true,
      message: "Sign in to manage feedback widgets.",
    },
    { status: 401 },
  )

export async function GET(request: NextRequest) {
  const userId = await sessionUser(request)
  if (!userId) return authRequired()
  try {
    const items = await listFeedbackWidgets(userId)
    return NextResponse.json({ items })
  } catch (error) {
    console.error("[feedback/widgets] list failed", error)
    return NextResponse.json({ message: "Failed to load widgets" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const userId = await sessionUser(request)
  if (!userId) return authRequired()

  let body: { name?: unknown; questions?: unknown; triggerLabel?: unknown; accent?: unknown } | null
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 })
  }

  const name = typeof body?.name === "string" ? body.name : ""
  const questions = Array.isArray(body?.questions)
    ? (body.questions as FeedbackQuestion[])
    : undefined
  const triggerLabel = typeof body?.triggerLabel === "string" ? body.triggerLabel : undefined
  const accent = typeof body?.accent === "string" ? body.accent : undefined

  try {
    const widget = await createFeedbackWidget({ userId, name, questions, triggerLabel, accent })
    return NextResponse.json(widget)
  } catch (error) {
    console.error("[feedback/widgets] create failed", error)
    return NextResponse.json({ message: "Failed to create widget" }, { status: 500 })
  }
}
