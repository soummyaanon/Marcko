import { NextRequest, NextResponse } from "next/server"

import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  getFeedbackWidgetByPublicKey,
  hashIp,
  isRateLimited,
  recordFeedbackResponse,
  sanitizeAnswers,
} from "@/lib/feedback"

export const runtime = "nodejs"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
}

const withCors = (response: NextResponse): NextResponse => {
  for (const [k, v] of Object.entries(corsHeaders)) {
    response.headers.set(k, v)
  }
  return response
}

const extractIp = (request: NextRequest): string => {
  const fwd = request.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  const real = request.headers.get("x-real-ip")
  if (real) return real
  return "unknown"
}

export const OPTIONS = async () => {
  return withCors(new NextResponse(null, { status: 204 }))
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ publicKey: string }> },
) {
  const { publicKey } = await context.params
  const widget = await getFeedbackWidgetByPublicKey(publicKey).catch(() => null)
  if (!widget) {
    return withCors(NextResponse.json({ message: "Widget not found" }, { status: 404 }))
  }

  let body:
    | {
        answers?: unknown
        submitterName?: unknown
        pageUrl?: unknown
      }
    | null
  try {
    body = (await request.json()) as typeof body
  } catch {
    return withCors(NextResponse.json({ message: "Invalid JSON" }, { status: 400 }))
  }

  let submitterName: string | null = null
  if (widget.collectName) {
    const raw = typeof body?.submitterName === "string" ? body.submitterName.trim() : ""
    if (widget.nameRequired && raw.length === 0) {
      return withCors(
        NextResponse.json({ message: "Please share your name." }, { status: 400 }),
      )
    }
    if (raw.length > 120) {
      return withCors(
        NextResponse.json({ message: "Name is too long." }, { status: 400 }),
      )
    }
    submitterName = raw.length > 0 ? raw : null
  }

  const sanitized = sanitizeAnswers(widget.questions, body?.answers)
  if (!sanitized.ok) {
    return withCors(NextResponse.json({ message: sanitized.reason }, { status: 400 }))
  }
  if (Object.keys(sanitized.answers).length === 0 && !submitterName) {
    return withCors(
      NextResponse.json({ message: "No answers provided" }, { status: 400 }),
    )
  }

  const ipHash = hashIp(extractIp(request))
  if (
    await isRateLimited({ widgetId: widget.id, ipHash }).catch(() => false)
  ) {
    const response = NextResponse.json(
      {
        message: `Too many submissions. Try again in ${Math.round(RATE_LIMIT_WINDOW_MS / 1000)}s.`,
      },
      { status: 429 },
    )
    response.headers.set("Retry-After", `${Math.round(RATE_LIMIT_WINDOW_MS / 1000)}`)
    response.headers.set("X-RateLimit-Limit", String(RATE_LIMIT_MAX))
    return withCors(response)
  }

  try {
    const userAgent = request.headers.get("user-agent")
    const pageUrl =
      typeof body?.pageUrl === "string" && body.pageUrl.length <= 500
        ? body.pageUrl
        : null

    await recordFeedbackResponse({
      widgetId: widget.id,
      answers: sanitized.answers,
      submitterName,
      pageUrl,
      userAgent,
      ipHash,
    })
    return withCors(NextResponse.json({ ok: true }))
  } catch (error) {
    console.error("[feedback/public] submit failed", error)
    return withCors(
      NextResponse.json({ message: "Failed to record feedback" }, { status: 500 }),
    )
  }
}
