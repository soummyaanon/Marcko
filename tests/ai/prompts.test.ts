import { describe, expect, it } from "vitest"
import { buildPrompt } from "@/lib/ai/prompts/inline"

describe("buildPrompt", () => {
  it("rewrite emits selection in tags and asks for replacement only", () => {
    const out = buildPrompt({
      action: "rewrite",
      selection: "Hello world",
      context: "intro paragraph",
    })
    expect(out.user).toContain("<selection>Hello world</selection>")
    expect(out.user.toLowerCase()).toContain("rewrite")
    expect(out.user).toMatch(/replacement.*only|no explanation|no commentary/i)
  })

  it("translate includes target language in the instruction", () => {
    const out = buildPrompt({
      action: "translate",
      selection: "Hello",
      context: "",
      options: { targetLanguage: "Spanish" },
    })
    expect(out.user.toLowerCase()).toContain("spanish")
  })

  it("mermaid wraps the instruction with mermaid fence guidance", () => {
    const out = buildPrompt({
      action: "mermaid",
      selection: "",
      context: "We have an auth flow",
      options: { instructions: "show login → MFA → dashboard" },
    })
    expect(out.user.toLowerCase()).toContain("mermaid")
  })

  it("truncates context that is too large", () => {
    const big = "x".repeat(20_000)
    const out = buildPrompt({
      action: "rewrite",
      selection: "hi",
      context: big,
    })
    expect(out.user.length).toBeLessThan(20_000)
  })

  it("rejects non-printable control chars in selection", () => {
    expect(() =>
      buildPrompt({ action: "rewrite", selection: "ok\x07here", context: "" }),
    ).toThrow(/control/i)
  })
})
