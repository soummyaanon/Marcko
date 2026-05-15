import "server-only"

export const MODELS = {
  inlineFast: "gpt-4o-mini",
  inlineLong: "gpt-4o",
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
