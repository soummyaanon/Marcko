import "server-only"
import { createOpenAI } from "@ai-sdk/openai"
import { env } from "@/lib/env"

export const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY })
