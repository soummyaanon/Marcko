import { NextRequest, NextResponse } from "next/server"

import { getFeedbackWidgetByPublicKey } from "@/lib/feedback"

export const runtime = "nodejs"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
}

const withCors = (response: NextResponse): NextResponse => {
  for (const [k, v] of Object.entries(corsHeaders)) {
    response.headers.set(k, v)
  }
  return response
}

export const OPTIONS = async () => {
  return withCors(new NextResponse(null, { status: 204 }))
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ publicKey: string }> },
) {
  const { publicKey } = await context.params
  try {
    const widget = await getFeedbackWidgetByPublicKey(publicKey)
    if (!widget) {
      return withCors(
        NextResponse.json({ message: "Widget not found" }, { status: 404 }),
      )
    }
    return withCors(
      NextResponse.json({
        publicKey: widget.publicKey,
        name: widget.name,
        triggerLabel: widget.triggerLabel,
        accent: widget.accent,
        questions: widget.questions,
        collectName: widget.collectName,
        nameRequired: widget.nameRequired,
      }),
    )
  } catch (error) {
    console.error("[feedback/public] get failed", error)
    return withCors(
      NextResponse.json({ message: "Failed to load widget" }, { status: 500 }),
    )
  }
}
