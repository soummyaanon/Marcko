#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod"

const DEFAULT_BASE_URL = "https://marcko.bixai.dev"

const env = (key: string): string | undefined => {
  const value = process.env[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

const apiKey = env("MARCKO_API_KEY")
const baseUrl = (env("MARCKO_BASE_URL") ?? DEFAULT_BASE_URL).replace(/\/$/, "")

if (!apiKey) {
  // We still start the server so Claude Desktop reports a clean handshake,
  // but every tool call will return an actionable error.
  console.error(
    "[marcko-mcp] MARCKO_API_KEY is not set. Generate one at " +
      `${baseUrl}/ → Account → Connect Claude Desktop, then add it to your MCP config.`,
  )
}

const PublishInput = z.object({
  content: z
    .string()
    .min(1, "content cannot be empty")
    .describe(
      "The full markdown (or HTML/CSS/JS in fenced blocks) to publish to Marcko.",
    ),
  title: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .optional()
    .describe(
      "Optional document title. Marcko derives a preview from content; this is currently informational.",
    ),
  visibility: z
    .enum(["public", "private"])
    .default("public")
    .describe(
      "`public` = anyone with the link can view. `private` = only signed-in Marcko users with the link.",
    ),
})

type PublishInput = z.infer<typeof PublishInput>

const PublishResponse = z.object({
  id: z.string().min(1),
  shareUrl: z.string().url(),
  visibility: z.enum(["public", "private"]),
})

type PublishResponse = z.infer<typeof PublishResponse>

const tryParseJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const truncate = (text: string, max = 240): string =>
  text.length > max ? `${text.slice(0, max)}…` : text

const publishToMarcko = async (input: PublishInput): Promise<PublishResponse> => {
  if (!apiKey) {
    throw new Error(
      "MARCKO_API_KEY is not configured for this MCP server. " +
        "Open Marcko → Account menu → Connect Claude Desktop to generate one.",
    )
  }

  const response = await fetch(`${baseUrl}/api/share`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      "user-agent": "marcko-mcp/0.1.0",
    },
    body: JSON.stringify({
      content: input.content,
      title: input.title,
      visibility: input.visibility,
    }),
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

  const validated = PublishResponse.safeParse(parsed)
  if (!validated.success) {
    throw new Error(
      `Marcko returned an unexpected response shape: ${truncate(rawBody)}`,
    )
  }
  return validated.data
}

const server = new Server(
  {
    name: "marcko-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "publish_to_marcko",
      description:
        "Publish a markdown (or HTML/CSS/JS-in-fence) document to the user's Marcko library. " +
        "Returns the share URL the user can paste anywhere. Use this whenever the user asks to " +
        "'send to Marcko', 'publish to Marcko', 'share this draft', or wants a permanent share URL.",
      inputSchema: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description:
              "The full markdown (or HTML/CSS/JS in fenced blocks) to publish to Marcko.",
            minLength: 1,
          },
          title: {
            type: "string",
            description:
              "Optional document title. Currently informational; Marcko derives a preview from content.",
            maxLength: 160,
          },
          visibility: {
            type: "string",
            enum: ["public", "private"],
            description:
              "'public' = anyone with the link can view. 'private' = only signed-in Marcko users with the link. Default: public.",
            default: "public",
          },
        },
        required: ["content"],
        additionalProperties: false,
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "publish_to_marcko") {
    throw new Error(`Unknown tool: ${request.params.name}`)
  }

  const parsed = PublishInput.safeParse(request.params.arguments ?? {})
  if (!parsed.success) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Invalid arguments: ${parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
            .join("; ")}`,
        },
      ],
    }
  }

  try {
    const result = await publishToMarcko(parsed.data)
    return {
      content: [
        {
          type: "text",
          text:
            `Published to Marcko (${result.visibility}).\n` +
            `Share URL: ${result.shareUrl}`,
        },
      ],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Failed to publish to Marcko: ${message}`,
        },
      ],
    }
  }
})

const main = async () => {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`[marcko-mcp] connected · base=${baseUrl}`)
}

main().catch((error) => {
  console.error("[marcko-mcp] fatal", error)
  process.exit(1)
})
