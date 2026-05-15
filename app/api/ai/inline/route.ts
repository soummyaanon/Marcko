import "server-only"
import { z } from "zod"
import { streamText } from "ai"
import { openai } from "@/lib/ai/openai"
import { withProGate, withQuota } from "@/lib/ai/guards"
import { buildPrompt } from "@/lib/ai/prompts/inline"
import { pickModel, type AIAction } from "@/lib/ai/models"
import { recordUsage } from "@/lib/ai/usage"

export const runtime = "nodejs"
export const maxDuration = 60

const bodySchema = z.object({
  action: z.enum([
    "rewrite",
    "expand",
    "shorten",
    "grammar",
    "translate",
    "tone",
    "generate_section",
    "mermaid",
    "table",
    "code",
    "summarize",
  ]) satisfies z.ZodType<AIAction>,
  selection: z.string().max(8 * 1024).default(""),
  context: z.string().max(16 * 1024).default(""),
  options: z
    .object({
      targetLanguage: z.string().max(40).optional(),
      tone: z.enum(["casual", "formal", "technical", "friendly"]).optional(),
      instructions: z.string().max(2_000).optional(),
    })
    .optional(),
})

export const POST = withProGate(
  withQuota("inline_edit", async (req, ctx) => {
    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      return Response.json({ error: "invalid_json" }, { status: 400 })
    }
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      return Response.json({ error: "invalid_body" }, { status: 400 })
    }
    const { action, selection, context, options } = parsed.data

    let prompt
    try {
      prompt = buildPrompt({ action, selection, context, options })
    } catch {
      return Response.json({ error: "invalid_input" }, { status: 400 })
    }

    const model = pickModel(action, context.length)
    const maxOutputTokens = action === "generate_section" ? 2048 : 1024
    const startedAt = Date.now()

    const result = streamText({
      model: openai(model),
      system: prompt.system,
      prompt: prompt.user,
      maxOutputTokens,
      onFinish: async ({ usage }) => {
        // AI SDK v6 usage shape: { inputTokens, outputTokens, totalTokens }
        await recordUsage({
          userId: ctx.userId,
          kind: "inline_edit",
          model,
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
          ms: Date.now() - startedAt,
        })
      },
    })

    // Plain text stream: each chunk is the next bit of text, no JSON parsing
    // needed on the client. Simpler than toUIMessageStreamResponse() for our
    // single-shot inline completion use case.
    return result.toTextStreamResponse()
  }),
)
