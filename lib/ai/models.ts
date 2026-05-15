import "server-only"

export const MODELS = {
  inlineFast: "gpt-5-mini",
  inlineLong: "gpt-5",
  embedding: "text-embedding-3-small",
} as const

export type AIAction =
  | "rewrite" | "expand" | "shorten" | "grammar"
  | "translate" | "tone"
  | "generate_section" | "mermaid" | "table" | "code" | "summarize"

export function pickModel(action: AIAction, contextLen: number): string {
  if (action === "generate_section" && contextLen > 4000) return MODELS.inlineLong
  return MODELS.inlineFast
}
