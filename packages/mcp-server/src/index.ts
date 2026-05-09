#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"

import {
  CreateFeedbackInput,
  GetEmbedInput,
  ListFeedbackInput,
  ListResponsesInput,
  PublishInput,
  PublishResponse,
  WidgetBase,
  WidgetDetailResponse,
  WidgetListResponse,
} from "./schemas.js"

const DEFAULT_BASE_URL = "https://marcko.bixai.dev"
const VERSION = "0.2.1"

const env = (key: string): string | undefined => {
  const value = process.env[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

const apiKey = env("MARCKO_API_KEY")
const baseUrl = (env("MARCKO_BASE_URL") ?? DEFAULT_BASE_URL).replace(/\/$/, "")

if (!apiKey) {
  console.error(
    "[marcko-mcp] MARCKO_API_KEY is not set. Generate one at " +
      `${baseUrl}/ → Account → Connect AI agents, then add it to your MCP config.`,
  )
}

const tryParseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const truncate = (text: string, max = 240): string =>
  text.length > max ? `${text.slice(0, max)}…` : text

type FetchInit = {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
}

const apiFetch = async <T>(
  path: string,
  init: FetchInit,
  schema: z.ZodType<T>,
): Promise<T> => {
  if (!apiKey) {
    throw new Error(
      "MARCKO_API_KEY is not configured. Open Marcko → Account → Connect AI agents to generate one.",
    )
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "user-agent": `marcko-mcp/${VERSION}`,
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })

  const rawBody = await response.text()
  const parsed = tryParseJson(rawBody)

  if (!response.ok) {
    const data = (parsed ?? {}) as { message?: unknown; code?: unknown }
    if (data?.code === "AUTH_REQUIRED") {
      throw new Error(
        "Marcko did not accept the API key. Generate a new one in the app and update MARCKO_API_KEY.",
      )
    }
    if (typeof data?.message === "string" && data.message.length > 0) {
      throw new Error(data.message)
    }
    const snippet = rawBody.trim().length > 0 ? ` — ${truncate(rawBody.trim())}` : ""
    throw new Error(`Marcko returned HTTP ${response.status}${snippet}`)
  }

  const validated = schema.safeParse(parsed)
  if (!validated.success) {
    throw new Error(`Marcko returned an unexpected response shape: ${truncate(rawBody)}`)
  }
  return validated.data
}

// ---------- publish_to_marcko ----------

const publishToMarcko = (input: PublishInput) =>
  apiFetch(
    "/api/share",
    {
      method: "POST",
      body: { content: input.content, title: input.title, visibility: input.visibility },
    },
    PublishResponse,
  )

// ---------- feedback widgets ----------

const listFeedbackWidgets = () =>
  apiFetch("/api/feedback/widgets", { method: "GET" }, WidgetListResponse)

const createFeedback = (input: z.infer<typeof CreateFeedbackInput>) =>
  apiFetch("/api/feedback/widgets", { method: "POST", body: input }, WidgetBase)

const buildSnippets = (origin: string, key: string) => ({
  hosted: `<script src="${origin}/widget.js" data-key="${key}"></script>`,
  manual: `<!-- Marcko Feedback (Electron / strict CSP) -->
<script>
  (function(){var s=document.createElement('script');s.src='${origin}/widget.js';s.async=true;s.dataset.key='${key}';document.body.appendChild(s);})();
</script>`,
  custom: `<!-- Suppress floating button; trigger from your own UI -->
<script src="${origin}/widget.js" data-key="${key}" data-trigger="custom"></script>

<!-- Click-to-open: any element with this attribute -->
<button data-marcko-feedback>Send feedback</button>

<!-- Or programmatically -->
<script>
  window.MarckoFeedback.open()
  window.addEventListener('marcko:submit', e => console.log(e.detail))
</script>`,
  react: `// components/MarckoFeedback.tsx
"use client"
import { useEffect } from "react"

export function MarckoFeedback() {
  useEffect(() => {
    if (document.querySelector('script[data-marcko-feedback-loader]')) return
    const s = document.createElement("script")
    s.src = "${origin}/widget.js"
    s.async = true
    s.dataset.key = "${key}"
    s.dataset.marckoFeedbackLoader = "1"
    document.body.appendChild(s)
  }, [])
  return null
}

// app/layout.tsx — render once, anywhere
// <MarckoFeedback />`,
})

const listFeedbackResponses = (id: string) =>
  apiFetch(
    `/api/feedback/widgets/${encodeURIComponent(id)}`,
    { method: "GET" },
    WidgetDetailResponse,
  )

// ---------- server ----------

const server = new Server(
  { name: "marcko-mcp", version: VERSION },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "publish_to_marcko",
      description:
        "Publish a markdown (or HTML/CSS/JS-in-fence) document to the user's Marcko library. " +
        "Returns the share URL. Use whenever the user asks to 'send to Marcko', 'publish to Marcko', or wants a permanent share URL.",
      inputSchema: {
        type: "object",
        properties: {
          content: { type: "string", minLength: 1 },
          title: { type: "string", maxLength: 160 },
          visibility: { type: "string", enum: ["public", "private"], default: "public" },
        },
        required: ["content"],
        additionalProperties: false,
      },
    },
    {
      name: "list_feedback_widgets",
      description:
        "List the user's Marcko Feedback widgets — names, public keys, response counts, last activity. " +
        "Use to check what's already configured before creating something new.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "create_feedback_widget",
      description:
        "Create a new Marcko Feedback widget. ALWAYS ask the user first what kind of feedback they want to collect — " +
        "rating, free-form comment, multiple-choice, etc. — and what to label each question. " +
        "Returns the widget with its publicKey; pair this with get_feedback_embed to give the user a snippet to paste, " +
        "or paste it directly into their app code if they prefer.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 80 },
          triggerLabel: { type: "string", minLength: 1, maxLength: 40 },
          accent: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
          questions: {
            type: "array",
            maxItems: 12,
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["short_text", "long_text", "rating", "single_choice"],
                },
                label: { type: "string", minLength: 1, maxLength: 240 },
                required: { type: "boolean" },
                placeholder: { type: "string", maxLength: 160 },
                options: {
                  type: "array",
                  items: { type: "string", minLength: 1, maxLength: 60 },
                  maxItems: 8,
                },
              },
              required: ["type", "label"],
              additionalProperties: false,
            },
          },
          collectName: { type: "boolean", default: true },
          nameRequired: { type: "boolean", default: true },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
    {
      name: "get_feedback_embed",
      description:
        "Get the embed snippet(s) for a feedback widget. Use after create_feedback_widget — " +
        "either show the snippet to the user OR (if you have file-edit access in this client) drop it into their app yourself. " +
        "Choose 'react' for Next.js/React apps, 'manual' for Electron / strict CSP, 'custom' to attach to an existing button, " +
        "'hosted' for a plain <script> tag, or 'all' to compare.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          format: {
            type: "string",
            enum: ["hosted", "manual", "custom", "react", "all"],
            default: "hosted",
          },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
    {
      name: "list_feedback_responses",
      description:
        "Read recent responses for a feedback widget. Surfaces submitter name (when collected), each answer, page URL, and submission time.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          limit: { type: "number", minimum: 1, maximum: 100 },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  ],
}))

const errorResult = (message: string) => ({
  isError: true,
  content: [{ type: "text" as const, text: message }],
})

const okText = (text: string) => ({
  content: [{ type: "text" as const, text }],
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name
  const args = request.params.arguments ?? {}

  try {
    if (name === "publish_to_marcko") {
      const parsed = PublishInput.safeParse(args)
      if (!parsed.success) return errorResult(`Invalid arguments: ${parsed.error.message}`)
      const result = await publishToMarcko(parsed.data)
      return okText(
        `Published to Marcko (${result.visibility}).\nShare URL: ${result.shareUrl}`,
      )
    }

    if (name === "list_feedback_widgets") {
      ListFeedbackInput.parse(args)
      const { items } = await listFeedbackWidgets()
      if (items.length === 0) {
        return okText(
          "No feedback widgets yet. Use create_feedback_widget to make one.",
        )
      }
      const lines = items.map((w) => {
        const last = w.lastResponseAt ? new Date(w.lastResponseAt).toISOString() : "never"
        return `- ${w.name} (id: ${w.id}, key: ${w.publicKey}) · ${w.responseCount} responses · last: ${last}`
      })
      return okText(`Found ${items.length} widget(s):\n${lines.join("\n")}`)
    }

    if (name === "create_feedback_widget") {
      const parsed = CreateFeedbackInput.safeParse(args)
      if (!parsed.success) return errorResult(`Invalid arguments: ${parsed.error.message}`)
      const widget = await createFeedback(parsed.data)
      const snippets = buildSnippets(baseUrl, widget.publicKey)
      return okText(
        [
          `Created widget "${widget.name}".`,
          `id: ${widget.id}`,
          `publicKey: ${widget.publicKey}`,
          `questions: ${widget.questions.length}`,
          `collectName: ${widget.collectName} (required: ${widget.nameRequired})`,
          ``,
          `Drop this snippet into the user's app:`,
          ``,
          snippets.hosted,
          ``,
          `Other formats available via get_feedback_embed (react, manual, custom).`,
        ].join("\n"),
      )
    }

    if (name === "get_feedback_embed") {
      const parsed = GetEmbedInput.safeParse(args)
      if (!parsed.success) return errorResult(`Invalid arguments: ${parsed.error.message}`)
      // Resolve publicKey from id by reading the widget detail
      const detail = await listFeedbackResponses(parsed.data.id)
      const snippets = buildSnippets(baseUrl, detail.widget.publicKey)
      if (parsed.data.format === "all") {
        return okText(
          [
            `Embed snippets for "${detail.widget.name}" (key: ${detail.widget.publicKey}):`,
            ``,
            `--- hosted ---`,
            snippets.hosted,
            ``,
            `--- manual (Electron / strict CSP) ---`,
            snippets.manual,
            ``,
            `--- custom (your own trigger) ---`,
            snippets.custom,
            ``,
            `--- react ---`,
            snippets.react,
          ].join("\n"),
        )
      }
      return okText(snippets[parsed.data.format])
    }

    if (name === "list_feedback_responses") {
      const parsed = ListResponsesInput.safeParse(args)
      if (!parsed.success) return errorResult(`Invalid arguments: ${parsed.error.message}`)
      const detail = await listFeedbackResponses(parsed.data.id)
      const limit = parsed.data.limit ?? 25
      const items = detail.responses.slice(0, limit)
      if (items.length === 0) {
        return okText(`No responses yet for "${detail.widget.name}".`)
      }
      const formatted = items.map((r) => {
        const who = r.submitterName ? r.submitterName : "anonymous"
        const when = new Date(r.submittedAt).toISOString()
        const answers = Object.entries(r.answers)
          .map(([qid, value]) => {
            const q = detail.widget.questions.find((q) => q.id === qid)
            const label = q?.label ?? qid
            return `    - ${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`
          })
          .join("\n")
        const page = r.pageUrl ? `\n    page: ${r.pageUrl}` : ""
        return `· ${who} · ${when}${page}\n${answers}`
      })
      return okText(
        `Recent responses for "${detail.widget.name}" (showing ${items.length} of ${detail.responses.length}):\n\n${formatted.join("\n\n")}`,
      )
    }

    return errorResult(`Unknown tool: ${name}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return errorResult(`Tool ${name} failed: ${message}`)
  }
})

const main = async () => {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`[marcko-mcp] connected · version=${VERSION} · base=${baseUrl}`)
}

main().catch((error) => {
  console.error("[marcko-mcp] fatal", error)
  process.exit(1)
})
