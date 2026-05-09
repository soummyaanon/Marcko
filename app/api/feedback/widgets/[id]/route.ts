import { NextRequest, NextResponse } from "next/server"

import { resolveAuthUser } from "@/lib/api-keys"
import {
  deleteFeedbackWidget,
  getFeedbackWidgetForOwner,
  listFeedbackResponses,
  updateFeedbackWidget,
  type FeedbackQuestion,
} from "@/lib/feedback"

export const runtime = "nodejs"

const resolveUser = async (request: NextRequest) => {
  const resolved = await resolveAuthUser(request)
  return resolved?.userId ?? null
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await resolveUser(request)
  if (!userId) return authRequired()

  const { id } = await context.params
  try {
    const widget = await getFeedbackWidgetForOwner(userId, id)
    if (!widget) {
      return NextResponse.json({ message: "Widget not found" }, { status: 404 })
    }
    const responses = await listFeedbackResponses({ userId, widgetId: id })
    return NextResponse.json({ widget, responses })
  } catch (error) {
    console.error("[feedback/widgets/:id] get failed", error)
    return NextResponse.json({ message: "Failed to load widget" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await resolveUser(request)
  if (!userId) return authRequired()

  const { id } = await context.params
  let body:
    | {
        name?: unknown
        questions?: unknown
        triggerLabel?: unknown
        accent?: unknown
        collectName?: unknown
        nameRequired?: unknown
      }
    | null
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 })
  }

  try {
    const updated = await updateFeedbackWidget({
      userId,
      widgetId: id,
      name: typeof body?.name === "string" ? body.name : undefined,
      questions: Array.isArray(body?.questions)
        ? (body.questions as FeedbackQuestion[])
        : undefined,
      triggerLabel: typeof body?.triggerLabel === "string" ? body.triggerLabel : undefined,
      accent: typeof body?.accent === "string" ? body.accent : undefined,
      collectName: typeof body?.collectName === "boolean" ? body.collectName : undefined,
      nameRequired: typeof body?.nameRequired === "boolean" ? body.nameRequired : undefined,
    })
    if (!updated) {
      return NextResponse.json({ message: "Widget not found" }, { status: 404 })
    }
    return NextResponse.json(updated)
  } catch (error) {
    console.error("[feedback/widgets/:id] patch failed", error)
    return NextResponse.json({ message: "Failed to update widget" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await resolveUser(request)
  if (!userId) return authRequired()

  const { id } = await context.params
  try {
    const ok = await deleteFeedbackWidget(userId, id)
    if (!ok) return NextResponse.json({ message: "Widget not found" }, { status: 404 })
    return NextResponse.json({ ok: true, id })
  } catch (error) {
    console.error("[feedback/widgets/:id] delete failed", error)
    return NextResponse.json({ message: "Failed to delete widget" }, { status: 500 })
  }
}
